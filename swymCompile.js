SWYM.Compile = function(parsetree)
{
	var executable = [];
	SWYM.MainCScope = object(SWYM.DefaultGlobalCScope);

	var resultType = SWYM.CompileNode(parsetree, SWYM.MainCScope, executable);

	if( !resultType || resultType.nativeType !== "Void" )
	{
		if( resultType && resultType.multivalueOf !== undefined )
		{
			executable.push("#ToMultiDebugString");
		}
		else if( !resultType || resultType.nativeType !== "Void" )
		{
			executable.push("#ToDebugString");
		}
		
		executable.push("#Native", 1, function(value)
		{
			if( SWYM.doFinalOutput )
			{
				if( value !== undefined )
				{
					SWYM.DisplayOutput(value.data);
				}
				else
				{
					SWYM.LogError(0, "Fsckup: Program result was undefined.");
				}
			}
		});
	}

	return executable;
}

// The "base" node compiler, which gets called by CompileNode (below).
SWYM.CompileLValue = function(parsetree, cscope, executable)
{
	if( parsetree === undefined )
	{
		return SWYM.VoidType;
	}

	if( parsetree.etcExpansionId !== undefined )
	{
		var childExecutable = [];
		
		cscope = object(cscope);
		cscope["<etcExpansionCurrent>"] = SWYM.DontCareType;
		
		if( parsetree.op !== undefined )
		{
			if( parsetree.op.text === "," )
			{
				cscope["<etcExpansionCurrent>"] = SWYM.ToMultivalueType(SWYM.DontCareType); //FIXME
			}
			
			SWYM.pushEach(["#Native", 0, parsetree.op.behaviour.identity], executable);
		}
		else if( parsetree.type === "fnnode" )
		{
			SWYM.pushEach(["#Literal", SWYM.GetFunctionIdentity(parsetree, cscope)], executable);
		}
		
		SWYM.pushEach([
			"#Load", "<etcIndex>",
			"#EtcExpansion", childExecutable
		], executable);
		
		executable = childExecutable;
		
		// and now we proceed to compile the node into childExecutable...
	}

	if ( parsetree.type === "etc" )
	{
		return SWYM.CompileEtc(parsetree, cscope, executable);
	}
	else if( parsetree.op && parsetree.op.behaviour.customCompile )
	{
		return parsetree.op.behaviour.customCompile(parsetree, cscope, executable);
	}
	else if ( parsetree.type === "literal" )
	{
		if( typeof parsetree.value === "number" ) // the javascript type, that is
		{
			executable.push("#Literal");
			executable.push(parsetree.value);
			return SWYM.BakedValue(parsetree.value);
		}
		else if( typeof parsetree.value === "string" )
		{
			executable.push("#Literal");
			var str = SWYM.StringWrapper(parsetree.value);
			executable.push(str);
			return SWYM.BakedValue(str);
		}
		else if ( parsetree.etcSequence )
		{
			executable.push("#EtcSequence");
			executable.push(SWYM.EtcCreateGenerator(parsetree.etcSequence));
			return parsetree.etcSequence.type;
		}
		else if ( parsetree.etcExpandingSequence )
		{
			executable.push("#Load");
			executable.push("<etcIndex>");
			executable.push("#Load");
			executable.push("<etcExpansion>");
			executable.push("#Native");
			executable.push(2);
			executable.push(SWYM.EtcCreateExpandingGenerator(parsetree.etcExpandingSequence));
			return parsetree.etcExpandingSequence.type;
		}
		else
		{
			SWYM.LogError(parsetree, "Unexpected literal <"+parsetree.value+">.");
		}
	}
	else if ( parsetree.type === "name" )
	{
		var loadName = parsetree.text;
		var loadName = SWYM.CScopeRedirect(cscope, loadName);
		var scopeEntry = cscope[loadName];
		
		if( scopeEntry === undefined )
		{
			if( parsetree.text === "__default" )
			{
				SWYM.LogError(parsetree, "There is no default value in this context.");	
			}
			else
			{
				SWYM.LogError(parsetree, "Unknown identifier \""+parsetree.text+"\".");	
			}
		}
		else
		{
			executable.push("#Load");
			executable.push(loadName);
		}
		
		return scopeEntry;
	}
	else if ( parsetree.type === "fnnode" )
	{
		// a function expression
		if( parsetree.isDecl )
		{
			return SWYM.CompileFunctionDeclaration("fn#"+parsetree.name, parsetree.argNames, parsetree.children, parsetree.body, parsetree.returnTypeNode, cscope, executable);
		}
		else
		{
			return SWYM.CompileFunctionCall(parsetree, cscope, executable);
		}
	}
	else if ( parsetree.op )
	{
		var opFunction;
		if( !parsetree.children[0] && !parsetree.children[1] )
			opFunction = parsetree.op.behaviour.standalone;
		else if( !parsetree.children[1] )
			opFunction = parsetree.op.behaviour.postfix;
		else if( !parsetree.children[0] )
			opFunction = parsetree.op.behaviour.prefix;
		else
			opFunction = parsetree.op.behaviour.infix;
			
		var argTypes = parsetree.op.behaviour.argTypes;
		if( !argTypes ) argTypes = [];
		
		var numArgs = 0;
		var tempexecutable0 = [];
		if( parsetree.children[0] )
		{
			var type0 = SWYM.CompileNode( parsetree.children[0], cscope, tempexecutable0 );
			type0 = SWYM.TypeCoerce(argTypes[0], type0, parsetree.children[0], "operator '"+parsetree.op.text+"'");
			++numArgs;
		}

		var tempexecutable1 = [];
		if( parsetree.children[1] )
		{
			var type1 = SWYM.CompileNode( parsetree.children[1], cscope, tempexecutable1 );
			type1 = SWYM.TypeCoerce(argTypes[1], type1, parsetree.children[1], "operator '"+parsetree.op.text+"'");
			++numArgs;
		}

		SWYM.pushEach(tempexecutable0, executable);
		SWYM.pushEach(tempexecutable1, executable);
		
		if( type0 && type0.multivalueOf !== undefined )
		{
			SWYM.pushEach(["#DoMultiple", 0, numArgs, type0.quantifier === undefined? 1: type0.quantifier.length], executable);
			oldExecutable = executable;
			executable = [];
			oldExecutable.push(executable);
		}

		if( type1 && type1.multivalueOf !== undefined )
		{
			SWYM.pushEach(["#DoMultiple", numArgs-1, numArgs, type1.quantifier === undefined? 1: type1.quantifier.length], executable);
			oldExecutable = executable;
			executable = [];
			oldExecutable.push(executable);
		}
		
/*		if( (type0 && type0.multivalueOf !== undefined) || (type1 && type1.multivalueOf !== undefined) )
		{
			var isLazy = false;
			
			SWYM.pushEach(tempexecutable0, executable);
			if( parsetree.children[0] && (!type0 || type0.multivalueOf === undefined) )
			{
				executable.push("#SingletonArray");
			}
			else if( type0 && type0.isLazy )
			{
				isLazy = true;
			}
			
			SWYM.pushEach(tempexecutable1, executable);
			if( parsetree.children[1] && (!type1 || type1.multivalueOf === undefined) )
			{
				executable.push("#SingletonArray");
			}
			else if( type1 && type1.isLazy )
			{
				isLazy = true;
			}
			
			executable.push(isLazy? "#LazyNative": "#MultiNative");
			executable.push(numArgs);
			executable.push(opFunction);
			if( parsetree.op.behaviour.returnType )
			{
				return SWYM.ToMultivalueType(parsetree.op.behaviour.returnType);
			}
			else if( parsetree.op.behaviour.getReturnType )
			{
				return SWYM.ToMultivalueType(parsetree.op.behaviour.getReturnType(type0, type1));
			}
			else
			{
				SWYM.LogError(0, "Fsckup: Undefined return type for operator "+parsetree.op.text);
				return SWYM.ToMultivalueType(SWYM.DontCareType);
			}
		}
		else
		{
			SWYM.pushEach(tempexecutable0, executable);
			SWYM.pushEach(tempexecutable1, executable);
*/			if( typeof(opFunction) !== 'function' )
			{
				SWYM.LogError(parsetree.op, "Illegal use of operator "+parsetree.op.text);
			}
			executable.push("#Native");
			executable.push(numArgs);
			executable.push(opFunction);
			if( parsetree.op.behaviour.returnType )
			{
				returnType = parsetree.op.behaviour.returnType;
			}
			else if( parsetree.op.behaviour.getReturnType )
			{
				returnType = parsetree.op.behaviour.getReturnType(SWYM.ToSinglevalueType(type0), SWYM.ToSinglevalueType(type1));
			}
			else
			{
				SWYM.LogError(parsetree, "Fsckup: Undefined return type for operator "+parsetree.op.text);
				returnType = {type:"value"};
			}
//		}

		if( type1 && type1.multivalueOf !== undefined )
		{
			returnType = SWYM.ToMultivalueType(returnType, type1.quantifier);
		}

		if( type0 && type0.multivalueOf !== undefined )
		{
			returnType = SWYM.ToMultivalueType(returnType, type0.quantifier);
		}
		
		return returnType;
	}
	else
	{
		SWYM.LogError(parsetree, "Symbol \""+parsetree.text+"\" is illegal here.");
	}
	return SWYM.DontCareType; // if an error occurred, don't care about type
}

SWYM.CompileNode = function(node, cscope, executable)
{
	if( SWYM.errors )
	{
		return SWYM.DontCareType;
	}
	
	var resultType = SWYM.CompileLValue(node, cscope, executable);
	
	while(true)
	{
		if( !resultType )
		{
			break;
		}
		else if(resultType.multivalueOf !== undefined && resultType.quantifier !== undefined && resultType.quantifier.length >= 2 &&
			resultType.quantifier[0] === "EACH" && resultType.quantifier[1] === "EACH")
		{
			executable.push("#Flatten");
			resultType = {type:resultType.type, multivalueOf:resultType.multivalueOf, quantifier:resultType.quantifier.slice(1)};
		}
/* // autoresolving quantifiers that produce boolean values (bad idea)
		else if( resultType.multivalueOf !== undefined && resultType.quantifier !== undefined && resultType.quantifier[0] !== "EACH" && resultType.multivalueOf === SWYM.BoolType )
		{
			// Insert the instruction(s) to resolve this quantifier into a single value

			var qexecutable = [];
			for( var Idx = resultType.quantifier.length-1; Idx >= 0; --Idx )
			{
				var q = resultType.quantifier[Idx];
				
				if( q === "OR" )
				{
					qexecutable.push("#ORQuantifier");
				}
				else if( q === "AND" )
				{
					qexecutable.push("#ANDQuantifier");
				}
				else if( q === "NOR" )
				{
					qexecutable.push("#NORQuantifier");
				}
				else if( q === "NAND" )
				{
					qexecutable.push("#NANDQuantifier");
				}
				
				if( Idx > 0 )
				{
					qexecutable = ["#DoMultiple", 0, 1, 1, qexecutable];
				}
			}
			SWYM.pushEach( qexecutable, executable );
			resultType = SWYM.BoolType;
		}
*/		else
		{
			break;
		}
	}
	
	var testType = resultType;
	
	if( resultType && resultType.multivalueOf !== undefined )
		testType = resultType.multivalueOf;
	
	// We want to condense an array of StringChars into a String.
	// This slightly dodgy test checks for an array of StringChars that's not already a String.
	if( testType && testType.nativeType !== "String" && !testType.isMutable &&
		testType.outType &&	testType.outType.isStringChar &&
		testType.memberTypes && testType.memberTypes.length && !testType.isLazy )
	{
		if( resultType.multivalueOf !== undefined )
		{
			executable.push("#MultiNative");
			executable.push(1);
			executable.push(function(v){ return SWYM.StringWrapper(SWYM.ToTerseString(v)); });
			resultType = SWYM.ToMultivalueType(SWYM.StringType);
		}
		else
		{
			executable.push("#ToTerseString");
			
			if( testType.baked !== undefined )
			{
				resultType = SWYM.BakedValue(SWYM.StringWrapper(SWYM.ToTerseString(testType.baked)));
			}
			else if( testType.memberTypes.length.baked !== undefined )
			{
				resultType = SWYM.FixedLengthStringType(testType.memberTypes.length.baked);
			}
			else
			{
				resultType = SWYM.StringType;
			}
		}
	}

	return resultType;
}

SWYM.GetPositionalName = function(theFunction, expectedArgName)
{
	if( expectedArgName === "#" )
	{
		return undefined;
	}
	else if(expectedArgName === "this" && !theFunction.hasOnlyThis ) // 'this' can only be used as a positional argument if it's the _only_ argument.
	{
		return undefined;
	}
	
	var targetIdx = theFunction.expectedArgs[expectedArgName].index+1;
	
	if( theFunction.expectedArgs["this"] && theFunction.expectedArgs["this"].index < theFunction.expectedArgs[expectedArgName].index )
	{
		targetIdx -= 1;
	}

	if( theFunction.expectedArgs["#"] && theFunction.expectedArgs["#"].index < theFunction.expectedArgs[expectedArgName].index )
	{
		targetIdx -= 1;
	}
	
	return "__"+targetIdx;
}

SWYM.CompileFunctionCall = function(fnNode, cscope, executable, OUT)
{
	var fnName = fnNode.name;
	
	var numAnonymous = 0;
	var args = {};
	var argNames = [];
	for( var Idx = 0; Idx < fnNode.argNames.length; ++Idx )
	{
		if( fnNode.argNames[Idx] === "__" )
		{
			var argName = "__"+numAnonymous;
			++numAnonymous;
		}
		else
		{
			var argName = fnNode.argNames[Idx];
		}

		args[argName] = fnNode.children[Idx];
		argNames.push(argName);
	}

	var isMulti = false;
	var inputArgTypes = {};
	var inputArgExecutables = {};
	
	for( Idx = 0; Idx < argNames.length; ++Idx )
	{
		var inputExecutable = [];
		var inputArgName = argNames[Idx];
		var inputType = SWYM.CompileNode( args[inputArgName], cscope, inputExecutable );

		if( inputType && inputType.multivalueOf !== undefined )
		{
			isMulti = true;
		}

		inputArgTypes[inputArgName] = inputType;
		inputArgExecutables[inputArgName] = inputExecutable;
	}
	
	var fnScopeName = "fn#"+fnName;
	var overloads = cscope[fnScopeName];
	if( !overloads )
	{
		SWYM.LogError(fnNode, "Unknown function "+fnName);
		return SWYM.DontCareType;
	}
	
	var validOverloads = [];
	var invalidOverloads = [];
		
	for( var Idx = 0; Idx < overloads.length; ++Idx )
	{
		var overloadResult = SWYM.TestFunctionOverload(fnName, args, cscope, overloads[Idx], isMulti, inputArgTypes, inputArgExecutables, fnNode, false);
		
		if( overloadResult.error === undefined )
		{
			validOverloads.push(overloadResult);
		}
		else
		{
			invalidOverloads.push(overloads[Idx]);
		}
		
		if( Idx === overloads.length-1 && overloads.more )
		{
			// skip any 0-length entries
			do
			{
				Idx = -1;
				overloads = overloads.more;
			}
			while( Idx === overloads.length-1 && overloads.more );
			continue;
		}
	}
	
	if( validOverloads.length === 0 )
	{
		var bestError = undefined;
		var bestErrorQuality = -1;
		for( var Idx = 0; Idx < invalidOverloads.length; ++Idx )
		{
			var overloadResult = SWYM.TestFunctionOverload(fnName, args, cscope, invalidOverloads[Idx], isMulti, inputArgTypes, inputArgExecutables, fnNode, true);
			
			if( bestErrorQuality < overloadResult.quality )
			{
				bestError = overloadResult.error;
				bestErrorQuality = overloadResult.quality;
			}
		}

		SWYM.LogError(fnNode, bestError);
		return SWYM.DontCareType;
	}

	var chosenOverload = undefined;
	
	if( validOverloads.length === 1 )
	{
		chosenOverload = validOverloads[0];
	}
	else
	{
		// Try to choose the strictest overload
		var bestIdx = 0;
		var bestTypeChecks = validOverloads[0].typeChecks;
		for( var Idx = 1; Idx < validOverloads.length; ++Idx )
		{
			var curTypeChecks = validOverloads[Idx].typeChecks;
			
			if( SWYM.TypeChecksStricter(curTypeChecks, bestTypeChecks) )
			{
				bestIdx = Idx;
				bestTypeChecks = curTypeChecks;
			}
		}
		
		// Sanity check: is this one stricter than all the others?
		var isStricter = true;
		for( var Idx = 0; Idx < validOverloads.length; ++Idx )
		{
			if( bestIdx != Idx && !SWYM.TypeChecksStricter(bestTypeChecks, validOverloads[Idx].typeChecks) )
			{
				isStricter = false;
				break;
			}
		}
		
		if( isStricter )
		{
			chosenOverload = validOverloads[bestIdx];
		}
		else
		{
			SWYM.LogError(fnNode, "Too many valid overloads for "+fnName+"! (we don't do dynamic dispatch yet.)");
			return;
		}
	}

	if(OUT !== undefined)
	{
		OUT.theFunction = chosenOverload.theFunction;
	}
	
	return SWYM.CompileFunctionOverload( fnName, chosenOverload, cscope, executable );
}

SWYM.TypeChecksStricter = function(curTypeChecks, bestTypeChecks)
{
	var stricter = false;
	var noneWeaker = true;
	for( var inputArgName in curTypeChecks )
	{
		if( !stricter && !SWYM.TypeMatches( curTypeChecks[inputArgName], bestTypeChecks[inputArgName] ))
		{
			stricter = true;
		}

		if( !SWYM.TypeMatches( bestTypeChecks[inputArgName], curTypeChecks[inputArgName] ) )
		{
			// nope, it's stricter.
			return false;
		}
	}
	
	return stricter;
}

SWYM.RecordErrorOfQuality = function(overloadResult, quality)
{
	// Returns true if this is the worst error we've seen
	if( overloadResult.quality == 0 || overloadResult.quality > quality )
	{
		overloadResult.quality = quality;
		return true;
	}
	return false;
}

// returns {error:<an error>, executable:<an executable>, returnType:<a return type>}
SWYM.TestFunctionOverload = function(fnName, args, cscope, theFunction, isMulti, inputArgTypes, inputArgExecutables, errorNode, isErrorReport)
{
	var overloadResult = {theFunction:theFunction, error:undefined, executable:[], typeChecks:{}, returnType:undefined, quality:0};
	
	// surely we should precompute this information?
	var expectedArgNamesByIndex = [];
	var numArgs = 0;
	var hasOnlyThis = theFunction.expectedArgs["this"] !== undefined;
	for( var expectedArgName in theFunction.expectedArgs )
	{
		expectedArgNamesByIndex[ theFunction.expectedArgs[expectedArgName].index ] = expectedArgName;
		++numArgs;
		
		if( expectedArgName !== "this" && expectedArgName !== "#" )
		{
			hasOnlyThis = false;
		}
	}
		
	var nextPositionalArg = 0;
	var inputArgNameList = [];
	var qualityBonus = 0;
	var checkExtraneousArgs = true;

	// make sure all the expected args are present and of the correct types
	for( var expectedArgIndex = 0; expectedArgIndex < expectedArgNamesByIndex.length; ++expectedArgIndex )
	{
		var expectedArgName = expectedArgNamesByIndex[expectedArgIndex];
		
		if( expectedArgName && args[expectedArgName] === undefined )
		{
			var positionalArgName = theFunction.expectedArgs[expectedArgName].indexName;
			if( positionalArgName === undefined )
			{
				positionalArgName = "__"+nextPositionalArg;
			}
			
			// Some parameters don't accept anonymous positional arguments.
			if( args[positionalArgName] !== undefined && !theFunction.expectedArgs[expectedArgName].explicitNameRequired )
			{
				inputArgNameList[expectedArgIndex] = positionalArgName;
				++nextPositionalArg;
			}
			else if( theFunction.expectedArgs[expectedArgName].defaultValueNode === undefined )
			{
				// We found a missing parameter (and it's not allowed to be missing).
				if( !isErrorReport )
				{
					overloadResult.error = "i dunno some error";
					return overloadResult;
				}
				
				var typeSig = "";
				if( theFunction.expectedArgs[expectedArgName].typeCheck !== undefined )
				{
					typeSig = "("+SWYM.TypeToString( theFunction.expectedArgs[expectedArgName].typeCheck ) + ") ";
				}
				
				if( expectedArgName === "this" )
				{
					if( SWYM.RecordErrorOfQuality(overloadResult, 10) ) // very bad match
					{
						overloadResult.error = "Function '"+fnName+"' requires a 'this' parameter. something."+fnName+"";
					}
				}				
				else if( expectedArgName === "else" )
				{
					if( SWYM.RecordErrorOfQuality(overloadResult, 10) ) // very bad match
					{
						overloadResult.error = "Function '"+fnName+"' requires an 'else' parameter. fnName() else {...}";
					}
				}
				else if( args[positionalArgName] !== undefined && theFunction.expectedArgs[expectedArgName].explicitNameRequired )
				{
					if( SWYM.RecordErrorOfQuality(overloadResult, 50) ) // reasonable match, you just forgot to state the name
					{
						overloadResult.error = "Function '"+fnName+"'s parameter '"+expectedArgName+"' must be given explicitly: "+fnName+"("+expectedArgName+"=something)";
					}
					
					checkExtraneousArgs = false; // suppress errors about the extraneous positional argument
				}
				else
				{
					if( SWYM.RecordErrorOfQuality(overloadResult, 10) ) // very bad match
					{
						overloadResult.error = "Function '"+fnName+"' requires an additional argument "+typeSig+"'"+expectedArgName+"'";
					}
				}
				
				continue;
			}
		}
		else
		{
			inputArgNameList[expectedArgIndex] = expectedArgName;
		}

		var inputArgName = inputArgNameList[expectedArgIndex];
		if( inputArgName !== undefined ) // undefined = default parameter
		{
			if( inputArgTypes[inputArgName] )
			{
				var expectedArgTypeCheck = theFunction.expectedArgs[expectedArgName].typeCheck;

				if( !expectedArgTypeCheck )
				{
					expectedArgTypeCheck = SWYM.AnyType;
				}

				overloadResult.typeChecks[inputArgName] = expectedArgTypeCheck;
				if( SWYM.TypeMatches(expectedArgTypeCheck, inputArgTypes[inputArgName]) )
				{
					// Each valid argument increases the likelihood that this was the intended overload
					qualityBonus += 10;
				}
				else
				{
					// Found an argument of the wrong type
					if( !isErrorReport )
					{
						overloadResult.error = "eek an error, run!";
						return overloadResult;
					}

					if( SWYM.RecordErrorOfQuality(overloadResult, 100) ) // pretty good match - just the wrong type
					{
						var expectedString;
						if( inputArgTypes[inputArgName].baked !== undefined )
						{
							expectedString = " ("+SWYM.ToDebugString(inputArgTypes[inputArgName].baked)+" is not of type "+SWYM.TypeToString(expectedArgTypeCheck)+")";
						}
						else
						{
							expectedString = " (Expected "+SWYM.TypeToString(expectedArgTypeCheck)+", got "+SWYM.TypeToString(inputArgTypes[inputArgName])+")";
						}
						
						if( inputArgName !== expectedArgName )
						{
							overloadResult.error = "Positional argument "+inputArgName+" was the wrong type for parameter \""+expectedArgName+"\" during call to function '"+fnName+"'."+expectedString;
						}
						else
						{
							overloadResult.error = "Argument '"+expectedArgName+"' was the wrong type during call to function '"+fnName+"'."+expectedString;
						}
					}
					continue;
				}
			}
		}
	}
		
	// make sure there are no extraneous args
	if( checkExtraneousArgs )
	{
		for ( var remainingArgName in args )
		{
			var matched = false;
			for( var expectedArgIndex = 0; expectedArgIndex < expectedArgNamesByIndex.length; ++expectedArgIndex )
			{
				if( remainingArgName === inputArgNameList[expectedArgIndex] )
				{
					matched = true;
					break;
				}
			}
			
			if( !matched )
			{
				if( !isErrorReport )
				{
					overloadResult.error = "errors, lol";
					return overloadResult;
				}

				// terrible match: extraneous arguments are unlikely to be an accident
				//(it's not just a mistyped name - that would have been caught as a missing argument.)
				if( SWYM.RecordErrorOfQuality(overloadResult, 5) )
				{
					if(remainingArgName === "__mutator")
						overloadResult.error = "function '"+fnName+"' does not support = modification.";
					else
						overloadResult.error = "Unexpected argument '"+remainingArgName+"' during call to function '"+fnName+"'.";
				}
			}
		}
	}
	
	var finalArgTypes = [];
	for( var Idx = 0; Idx < inputArgNameList.length; Idx++ )
	{
		var inputArgName = inputArgNameList[Idx];
		finalArgTypes[Idx] = inputArgTypes[inputArgName];
	}
	
	if( theFunction.customTypeCheck )
	{
		var typeCheckResult = theFunction.customTypeCheck(finalArgTypes);
		if( typeCheckResult !== true )
		{
			if( !isErrorReport )
			{
				overloadResult.error = "error, whatevs";
				return overloadResult;
			}
			
			// pretty good match, just failed at the last hurdle
			if( SWYM.RecordErrorOfQuality(overloadResult, 120) )
			{
				overloadResult.error = typeCheckResult;
			}
			return overloadResult;
		}
	}

	
	if( isErrorReport )
	{
		if( overloadResult.error )
		{
			overloadResult.quality += qualityBonus;
			return overloadResult;
		}
		
		// Why are we still here!?
		SWYM.LogError(0, "Fsckup: Expected an error while compiling this overload");
	}

	// in order to support function overloads, this function has been split into two halves.
	// the logic continues in CompileFunctionOverload (below), using the following data.
	overloadResult.inputArgNameList = inputArgNameList;
	overloadResult.inputArgNodes = args; // we've finished processing these; they're just here for error reporting 
	overloadResult.expectedArgNamesByIndex = expectedArgNamesByIndex;
	overloadResult.inputArgTypes = inputArgTypes;
	overloadResult.finalArgTypes = finalArgTypes;
	overloadResult.inputArgExecutables = inputArgExecutables;
	overloadResult.theFunction = theFunction;
	overloadResult.isMulti = isMulti;
	overloadResult.errorNode = errorNode;
	return overloadResult;
}

//(fnName, args, cscope, theFunction, isMulti, inputArgTypes, inputArgExecutables)
SWYM.CompileFunctionOverload = function(fnName, data, cscope, executable)
{
	var argIndices = [];
	var customArgExecutables = [];
	var numArgsPassed = 0;
	var argNamesPassed = [];
	var argTypesPassed = [];
	var isMulti = data.isMulti;
	var isLazy = false;
	var isQuantifier = false;
	var theFunction = data.theFunction;
	var finalArgTypes = data.finalArgTypes;
	
	var numArgsPushed = 0;

	for( var Idx = 0; Idx < data.inputArgNameList.length; Idx++ )
	{
		var inputArgName = data.inputArgNameList[Idx];
		if( inputArgName === undefined )
		{
			// default parameter, presumably
			continue;
		}
		var expectedArgName = data.expectedArgNamesByIndex[Idx];
		var tempType = data.inputArgTypes[inputArgName];

		argIndices[Idx] = Idx;
		
		argTypesPassed[numArgsPassed] = SWYM.ToSinglevalueType(tempType);
		argNamesPassed[numArgsPassed] = theFunction.expectedArgs[expectedArgName].finalName;
		++numArgsPassed;

		if( tempType && tempType.multivalueOf !== undefined )
		{
			if( isMulti && tempType.isLazy )
			{
				isLazy = true;
			}
			if( tempType.quantifier !== undefined )
			{
				isQuantifier = true;
			}
		}
			
		if( theFunction.customCompileWithoutArgs || (theFunction.bakeOutArgs && theFunction.bakeOutArgs[Idx]) )
		{
			customArgExecutables[Idx] = data.inputArgExecutables[inputArgName];
		}
		else
		{
			++numArgsPushed;
			var argExecutable = data.inputArgExecutables[inputArgName];
			if( argExecutable )
			{
				SWYM.pushEach(argExecutable, executable);
			}
			else
			{
				SWYM.LogError(-1, "Fsckup: Missing argExecutable for function "+fnName+", arg '"+inputArgName+"'");
			}
			SWYM.TypeCoerce(theFunction.expectedArgs[expectedArgName].typeCheck, tempType, data.inputArgNodes[expectedArgName], "calling '"+fnName+"', argument "+expectedArgName);

//			if( isMulti && (!tempType || tempType.multivalueOf === undefined))
//			{
//				executable.push("#SingletonArray");
//			}
		}
	}
	
	if( isMulti && !theFunction.customCompileWithoutArgs )
	{
		var argPositionOnStack = 0;
		for( var Idx = 0; Idx < data.inputArgNameList.length; Idx++ )
		{
			var inputArgName = data.inputArgNameList[Idx];
			if( inputArgName !== undefined )
			{
				var tempType = data.inputArgTypes[inputArgName];

				if( tempType && tempType.multivalueOf !== undefined )
				{
					finalArgTypes[Idx] = SWYM.ToSinglevalueType(tempType);
					
					if( !theFunction.bakeOutArgs || !theFunction.bakeOutArgs[Idx] )
					{
						SWYM.pushEach(["#DoMultiple", argPositionOnStack, numArgsPushed, tempType.quantifier? tempType.quantifier.length: 1], executable);
						oldExecutable = executable;
						executable = [];
						oldExecutable.push(executable);
					}
				}

				if( !theFunction.bakeOutArgs || !theFunction.bakeOutArgs[Idx] )
				{
					++argPositionOnStack;
				}
			}
		}		
	}

	var resultType;
	var didMultiCustomCompile = false;
	if( theFunction.customCompileWithoutArgs )
	{
		if( !isMulti )
		{
			resultType = theFunction.customCompile(finalArgTypes, cscope, executable, data.errorNode, customArgExecutables);
		}
		else
		{
			//NB: multiCustomCompile is a special compile mode that takes raw multivalues (and/or normal values) as input.
			resultType = theFunction.multiCustomCompile(finalArgTypes, cscope, executable, data.errorNode, customArgExecutables);
			didMultiCustomCompile = true;
		}
	}
	else if ( theFunction.customCompile || theFunction.nativeCode )
	{
		if( theFunction.customCompile )
		{
			resultType = theFunction.customCompile(finalArgTypes, cscope, executable, data.errorNode, customArgExecutables);
		}
/*		else if( isMulti && theFunction.multiCustomCompile )
		{
			//NB: multiCustomCompile is a special compile mode that takes raw multivalues (and/or normal values) as input,
			// and generates multivalues as output. But for consistency with other compile modes,
			// its result_type_ is still expected to be a single value type.
			resultType = theFunction.multiCustomCompile(finalArgTypes, cscope, executable, customArgExecutables);
		}
		else if( isMulti && theFunction.customCompile && !theFunction.multiCustomCompile )
		{
			//var singularTypes = SWYM.Each(finalArgTypes, SWYM.ToSinglevalueType);
			resultType = theFunction.customCompile(finalArgTypes, cscope, executable, customArgExecutables);
		}
*/
		else if( theFunction.nativeCode )
		{
/*			if( isMulti )
			{
				executable.push(isLazy? "#LazyNative": "#MultiNative");
				executable.push(numArgsPushed);
				executable.push(theFunction.nativeCode);
			}
			else
			{
*/				executable.push("#Native");
				executable.push(numArgsPushed);
				executable.push(theFunction.nativeCode);
//			}
		}

		if( theFunction.getReturnType )
		{
			if( isMulti )
			{
				var singularTypes = SWYM.Each(finalArgTypes, SWYM.ToSinglevalueType);
				resultType = theFunction.getReturnType(singularTypes, cscope);
			}
			else
			{
				resultType = theFunction.getReturnType(finalArgTypes, cscope);
			}
		}
	}
	else
	{
		var precompiled = SWYM.GetPrecompiled(theFunction, argTypesPassed);
		
		if( precompiled.executable === undefined || (precompiled.isCompiling && !precompiled.isRecursive) )
		{
			var targetExecutable = [];
			
			if( precompiled.isCompiling )
			{
				// if we're compiling recursively, don't actually keep the target executable.
				// (only the outermost call will write the executable.)
				precompiled.isRecursive = true;
			}
			else
			{
				precompiled.executable = targetExecutable;
			}
			
			if( theFunction.compiling !== undefined && theFunction.compiling.length > 30 &&
				theFunction.compiling.indexOf(precompiled) === -1 )
			{
				// we appear to be compiling a recursive function whose argument types don't remain consistent
				// as it recurses. Illegal!
				SWYM.LogError(-1, "Inconsistent argument types during recursive function call to "+fnName+"!");
				return SWYM.DontCareType;
			}
			
			if( theFunction.returnType !== undefined && theFunction.returnType.type !== "incomplete" )
				precompiled.returnType = theFunction.returnType;
			else
				precompiled.returnType = SWYM.DontCareType; // treat recursive calls as though they yield our least offensive type.

			var bodyCScope = object(SWYM.MainCScope);
			for( var Idx = 0; Idx < argNamesPassed.length; Idx++ )
			{
				bodyCScope[argNamesPassed[Idx]] = argTypesPassed[Idx];
			}
			bodyCScope["__default"] = {redirect:"this"};

			var oldIsCompiling = precompiled.isCompiling;
			
			if( theFunction.compiling === undefined )
			{
				theFunction.compiling = [];
			}
			
			theFunction.compiling.push(precompiled);
			precompiled.isCompiling = true;
			precompiled.returnType = SWYM.CompileFunctionBody(fnName, theFunction, bodyCScope, targetExecutable);
			precompiled.isCompiling = oldIsCompiling;
			theFunction.compiling.pop();
			
			/*if( precompiled.isRecursive )
			{
				// if it's a recursive function, recompile now that we have proper type information.
				precompiled.executable.clear();
				precompiled.isCompiling = true;
				precompiled.returnType = SWYM.CompileFunctionBody(theFunction, bodyCScope, precompiled.executable);
				precompiled.isCompiling = false;
			}*/
			
			if( SWYM.errors )
			{
				for( var Idx = 0; Idx < theFunction.precompiled.length; ++Idx )
				{
					if( theFunction.precompiled[Idx] === precompiled )
					{
						theFunction.precompiled.splice(Idx, 1);
						break;
					}
				}
			}
		}

		resultType = precompiled.returnType;
	
/*		if( isMulti )
		{
			executable.push("#MultiFnCall");
			executable.push(fnName);
			executable.push(argNamesPassed);
			executable.push(precompiled.executable);
		}
		else
		{
*/			executable.push("#FnCall");
			executable.push(fnName);
			executable.push(argNamesPassed);
			executable.push(precompiled.executable);
//		}
	}
	
	if( resultType === undefined )
	{
		if( theFunction.returnType !== undefined )
		{
			resultType = theFunction.returnType;
		}
		else
		{
			resultType = SWYM.GetFunctionReturnType(finalArgTypes, argIndices, data.theFunction);
		}	
	}
		
	if( !didMultiCustomCompile && (isMulti || isQuantifier) )
	{
		for( var Idx = data.inputArgNameList.length-1; Idx >= 0; --Idx )
		{
			var inputArgName = data.inputArgNameList[Idx];
			if( inputArgName !== undefined )
			{
				var tempType = data.inputArgTypes[inputArgName];
				if( tempType && tempType.multivalueOf !== undefined )
				{
					resultType = SWYM.ToMultivalueType(resultType, tempType.quantifier);
				}
			}			
		}
	}

	return resultType;
}

SWYM.GetPrecompiled = function(theFunction, argTypes)
{
	if( !theFunction.precompiled )
	{
		theFunction.precompiled = [];
	}

	for( var Idx = 0; Idx < theFunction.precompiled.length; ++Idx )
	{
		var cur = theFunction.precompiled[Idx];
		var matched = !!cur.types && cur.types.length === argTypes.length;
		if( matched )
		{
			for( var AIdx = 0; AIdx < cur.types.length; ++AIdx )
			{
				if( argTypes[AIdx] )
				{
					if( !SWYM.TypeMatches(cur.types[AIdx], argTypes[AIdx], true) ||
						!SWYM.TypeMatches(argTypes[AIdx], cur.types[AIdx], true) )
					{
						matched = false;
						break;
					}
				}
			}
		}
		
		if( matched )
		{
			return cur;
		}
	}
	
	var result = { types:argTypes };
	theFunction.precompiled.push(result);
	return result;
}

SWYM.CompileFunctionDeclaration = function(fnName, argNames, argTypes, body, returnTypeNode, cscope, executable, errorNode)
{
//	var bodyCScope = object(cscope);
	var bodyScope = object(cscope);
	
	var expectedArgs = {};
	var numPositionalArgs = 0;

	for( var argIdx = 0; argIdx < argNames.length; ++argIdx )
	{
//		var typeCheck = {type:"value", canConstrain:true};
		var finalName = argNames[argIdx];
		var argNode = argTypes[argIdx];
		var defaultValueNode = undefined;
		
		if( finalName === "this" || finalName === "else" || finalName === "#" || finalName === "__mutator" )
		{
			// special arguments must always be passed explicitly by name
			// (we make an exception for "this" later in the function)
			argNode.explicitNameRequired = true;
		}
		else if( finalName === "__" )
		{
			// turn anonymous arguments (e.g: deconstructors with named parts,
			// but the argument as a whole is anonymous) into positional arguments
			finalName += argIdx;
		}
		
		if( !argNode.explicitNameRequired )
		{
			numPositionalArgs++;
		}

		var argData = {finalName:finalName, index:argIdx, explicitNameRequired:argNode.explicitNameRequired};

		if( argNode.op && argNode.op.text === "(" && !argNode.children[0] )
		{
			argNode = argNode.children[1];
		}
		
		if( argNode !== undefined && argNode.op && argNode.op.text === "=" )
		{
			argData.defaultValueNode = argNode.children[1];
			argNode = argNode.children[0];
		}
		
		if( argNode !== undefined && argNode.type === "decl" )
		{
			if( argNode.children !== undefined )
			{
				argNode = argNode.children[0];
			}
			else
			{
				argNode = undefined;
			}
		}
		
		if( argNode !== undefined )
		{
			if ( argNode.type === "node" && argNode.op.text === "[" )
			{
				// deconstructing arg
				argData.deconstructNode = argNode;
			}
				
			// a type check
			var typeCheckType = SWYM.GetTypeFromPatternNode(argNode, cscope);

			if( typeCheckType === undefined && argNode !== undefined )
			{
				SWYM.LogError(argNode, "Invalid type expression");
			}

			argData.typeCheck = typeCheckType;
		}
		
		expectedArgs[finalName] = argData;
	}
	
	// special exception for the "this" parameter: it can be passed
	// anonymously if there's no other anonymous argument.
	if( numPositionalArgs === 0 && expectedArgs["this"] !== undefined )
	{
		expectedArgs["this"].explicitNameRequired = false;
	}
	
	var returnType = {type:"incomplete", debugName:"incomplete"};
	if( returnTypeNode !== undefined )
	{
		var returnTypeBaked = SWYM.CompileNode(returnTypeNode, cscope, executable);
		if( returnTypeBaked === undefined || returnTypeBaked.baked === undefined || returnTypeBaked.baked.type !== "type" )
		{
			SWYM.LogError(returnTypeNode, "This return type is not a type!");
		}
		returnType = returnTypeBaked.baked;
	}

	if( fnName === "fn#$$" )
	{
		var structType = expectedArgs["this"].typeCheck;
		if( structType === undefined || structType.nativeType !== "Struct" )
		{
			SWYM.LogError(errorNode, "The $$ operator can only be declared on a struct type.");
			return SWYM.VoidType;
		}
		
		var debugName = structType.debugName;
		
		// Ugh... this is really hacky, and doesn't even work if stdlyb wants to define $$ overrides.
		//Surely we can do something better?
		var bodyExecutable = [];
		var bodyCScope = object(SWYM.MainCScope);
		bodyCScope["this"] = structType;
		bodyCScope["__default"] = {redirect:"this"};
		
		var returnType = SWYM.CompileNode(body, bodyCScope, bodyExecutable);
		SWYM.TypeCoerce(returnType, SWYM.StringType);
		
		structType.toDebugString = function(value)
		{
			var rscope = object(SWYM.MainRScope);
			rscope["this"] = value;
			return SWYM.ExecWithScope(debugName, bodyExecutable, rscope, []);
		}
		
		return SWYM.VoidType;
	}

	var cscopeFunction = {
		bodyNode:body,
		expectedArgs:expectedArgs,
		executable:[],
//		bodyCScope:bodyCScope, // used by implicit member definitions, like 'Yielded'.
		toString: function(){ return "'"+fnName+"'"; },
		returnType:returnType
	};

	SWYM.AddFunctionDeclaration(fnName, cscope, cscopeFunction);
		
	var negateExecutable = ["#Native",1,function(v){return !v}];

	if( fnName === "fn#<" )
	{
		expectedArgs["this"].explicitNameRequired = false;
		SWYM.AddModifiedFunctionDeclaration("fn#>=", fnName, cscope, cscopeFunction, negateExecutable);
		SWYM.AddSwappedFunctionDeclaration("fn#>", fnName, cscope, cscopeFunction, undefined);
		SWYM.AddSwappedFunctionDeclaration("fn#<=", fnName, cscope, cscopeFunction, negateExecutable);
	}
	else if( fnName === "fn#>" )
	{
		expectedArgs["this"].explicitNameRequired = false;
		SWYM.AddModifiedFunctionDeclaration("fn#<=", fnName, cscope, cscopeFunction, negateExecutable);
		SWYM.AddSwappedFunctionDeclaration("fn#<", fnName, cscope, cscopeFunction, undefined);
		SWYM.AddSwappedFunctionDeclaration("fn#>=", fnName, cscope, cscopeFunction, negateExecutable);
	}
	else if( fnName === "fn#<=" )
	{
		expectedArgs["this"].explicitNameRequired = false;
		SWYM.AddModifiedFunctionDeclaration("fn#>", fnName, cscope, cscopeFunction, negateExecutable);
		SWYM.AddSwappedFunctionDeclaration("fn#>=", fnName, cscope, cscopeFunction, undefined);
		SWYM.AddSwappedFunctionDeclaration("fn#<", fnName, cscope, cscopeFunction, negateExecutable);
	}
	else if( fnName === "fn#>=" )
	{
		expectedArgs["this"].explicitNameRequired = false;
		SWYM.AddModifiedFunctionDeclaration("fn#<", fnName, cscope, cscopeFunction, negateExecutable);
		SWYM.AddSwappedFunctionDeclaration("fn#<=", fnName, cscope, cscopeFunction, undefined);
		SWYM.AddSwappedFunctionDeclaration("fn#>", fnName, cscope, cscopeFunction, negateExecutable);
	}
	else if( fnName === "fn#==" )
	{
		SWYM.AddModifiedFunctionDeclaration("fn#!=", fnName, cscope, cscopeFunction, negateExecutable);
	}
	else if( fnName === "fn#!=" )
	{
		SWYM.AddModifiedFunctionDeclaration("fn#==", fnName, cscope, cscopeFunction, negateExecutable);
	}
	
	return SWYM.VoidType;
}

SWYM.AddFunctionDeclaration = function(fnName, cscope, cscopeFunction)
{
	if( !cscope[fnName] )
	{
		cscope[fnName] = [];
	}
	else if( !cscope.hasOwnProperty(fnName) )
	{
		// FIXME: this is technically wrong, we ought to go through the __proto__ chain adding a placeholder to every level of the scope.
		// there must be a better way to handle overloads...
		var temp = cscope[fnName];
		cscope[fnName] = [];
		cscope[fnName].more = temp;
	}

	cscope[fnName].push( cscopeFunction );
}

SWYM.AddModifiedFunctionDeclaration = function(fnName, baseName, cscope, baseFunction, postExec)
{
	var negatedFunction = {
		bodyNode:baseFunction.bodyNode,
		expectedArgs:baseFunction.expectedArgs,
		executable:[],
		postExec:postExec,
		toString: function(){ return "'"+fnName+"'"; },
		returnType:object(baseFunction.returnType)
	};

	SWYM.AddFunctionDeclaration(fnName, cscope, negatedFunction);
}

SWYM.AddSwappedFunctionDeclaration = function(fnName, baseName, cscope, baseFunction, postExec)
{
	var swappedArgs = object(baseFunction.expectedArgs);
	var arg0;
	var arg1;
	
	for( var argName in baseFunction.expectedArgs )
	{
		if( baseFunction.expectedArgs[argName].index === 0 )
		{
			arg0 = argName;
		}
		else if( baseFunction.expectedArgs[argName].index === 1 )
		{
			arg1 = argName;
		}
	}
	
	swappedArgs[arg0] = baseFunction.expectedArgs[arg1];
	swappedArgs[arg1] = baseFunction.expectedArgs[arg0];
	
	var swappedFunction = {
		bodyNode:baseFunction.bodyNode,
		expectedArgs:swappedArgs,
		executable:[],
		postExec:postExec,
		toString: function(){ return "'"+fnName+"'"; },
		returnType:object(baseFunction.returnType)
	};

	SWYM.AddFunctionDeclaration(fnName, cscope, swappedFunction);
}

SWYM.GetTypeFromPatternNode = function(node, cscope)
{
	if( node === undefined )
	{
		return SWYM.AnythingType;
	}
	else if ( node.type === "node" && node.op.text === "[" )
	{
		// array/tuple pattern such as [Int, Int]
		var elements = [];
		if( node.children[1] === undefined )
		{
			return SWYM.BakedValue(SWYM.jsArray([]));
		}
		else if( node.children[1].op !== undefined )
		{
			var opText = node.children[1].op.text;
			if( opText === ".." || opText === "..<" || opText === "<.." || opText === "<..<" )
			{
				return SWYM.RangeArrayType;
			}
			else if( opText === "," )
			{
				var result = SWYM.GetTypeFromTupleContentNode( node.children[1], cscope, elements );
				return SWYM.TupleTypeOf(elements, undefined, node);
			}
		}
		else
		{
			return SWYM.TupleTypeOf( [SWYM.GetTypeFromPatternNode(node.children[1], cscope)], undefined, node );
		}
	}
	else
	{
		var outType;
		var debugName;
		
		if( node.type === "decl" )
		{
			// a declaration such as Int 'x'
			if( node.children !== undefined )
			{
				return SWYM.GetTypeFromPatternNode(node.children[0], cscope);
			}
			else
			{
				return SWYM.AnythingType;
			}
		}
		else if( node.type === "name" )
		{
			// a type literal such as Int
			debugName = node.text;
			outType = cscope[node.text];
		}
		else
		{
			var executable = [];
			outType = SWYM.CompileNode(node, cscope, executable);
			debugName = "??<FIXME>";
		}

		if( outType === undefined )
		{
			SWYM.LogError(node, "Unknown type name "+debugName);
			return;
		}
		else if ( outType.baked === undefined || outType.baked.type !== "type" )
		{
			SWYM.LogError(node, "Name "+debugName+" does not describe a type.");
			return;
		}
		
		return outType.baked;
	}
}

SWYM.GetTypeFromTupleContentNode = function( node, cscope, elements )
{
	if( node !== undefined )
	{
		if( node.op && node.op.text === "," )
		{
			SWYM.GetTypeFromTupleContentNode( node.children[0], cscope, elements );
			SWYM.GetTypeFromTupleContentNode( node.children[1], cscope, elements );
		}
		else
		{
			elements.push( SWYM.GetTypeFromPatternNode(node, cscope) );
		}
	}
}

SWYM.CompileFunctionBody = function(fnName, theFunction, cscope, executable)
{
	var theCurrentFunction = object(theFunction);

	// settings for use by 'yield' and 'return' statements.	
	cscope["<withinFunction>"] = theCurrentFunction;
	theCurrentFunction.bodyCScope = cscope;
	
	var bodyExecutable = [];

	for( var argName in theFunction.expectedArgs )
	{
		var theArg = theFunction.expectedArgs[argName];
		var deconstructNode = theArg.deconstructNode;
		if( deconstructNode )
		{
			var argName = SWYM.CScopeRedirect(cscope, argName);
			
			bodyExecutable.push("#Load");
			bodyExecutable.push(argName);
			
			SWYM.CompileDeconstructor(deconstructNode, cscope, bodyExecutable, cscope[argName] );
			
			bodyExecutable.push("#Pop");
		}
		else if( cscope[argName] === undefined )
		{
			// this arg wasn't passed in; it better be a default parameter
			if( theArg.defaultValueNode )
			{
				var defaultValueType = SWYM.CompileNode(theArg.defaultValueNode, cscope, bodyExecutable);

				bodyExecutable.push("#Store");
				bodyExecutable.push(argName);

				cscope[argName] = defaultValueType;

				if( defaultValueType && theArg.typeCheck )
				{
					SWYM.TypeCoerce(theArg.typeCheck, defaultValueType, theArg.defaultValueNode, "default argument");
				}
			}
			else
			{
				SWYM.LogError(-1, "Fsckup: Failed to pass argument "+argName);
			}
		}
	}
	
	var bodyReturnType = SWYM.CompileLValue(theFunction.bodyNode, cscope, bodyExecutable);
	
	if( theCurrentFunction.returnsValue && theCurrentFunction.returnsNoValue )
	{
		SWYM.LogError(theFunction.bodyNode, "Not all returns from "+fnName+" return a value");
	}
	else if( theCurrentFunction.returnsValue && theCurrentFunction.yields )
	{
		SWYM.LogError(theFunction.bodyNode, "Function "+fnName+" cannot both yield and return values");
	}
	
	var returnType;

	if( theCurrentFunction.yields )
	{
		SWYM.pushEach(["#Literal", SWYM.jsArray([]), "#Store", "Yielded", "#Pop"], executable);
		
		if( theCurrentFunction.returnsNoValue )
			SWYM.pushEach(["#ReceiveReturnNoValue", bodyExecutable], executable);
		else
			SWYM.pushEach(bodyExecutable, executable);

		SWYM.pushEach(["#ClearStack", "#Load", "Yielded"], executable);
		// yield keyword will set the return type 
		returnType = theCurrentFunction.returnType;
	}
	else if( theCurrentFunction.returnsValue )
	{
		SWYM.pushEach(["#ReceiveReturnValue", bodyExecutable], executable);
		// return keyword will set the return type
		returnType = theCurrentFunction.returnType;
	}
	else if( theCurrentFunction.returnsNoValue )
	{
		SWYM.pushEach(["#ReceiveReturnNoValue", bodyExecutable], executable);
		theCurrentFunction.returnType = SWYM.VoidType;
		returnType = SWYM.VoidType;
	}
//	else if( bodyReturnType && bodyReturnType.multivalue )
//	{
//		// Force the default return to be a single value
//		SWYM.pushEach(["#Native", 1, function(v){return SWYM.ForceSingleValue(v);}], bodyExecutable);
//		cscopeFunction.returnType = SWYM.ToSinglevalueType(bodyReturnType);
//	}
	else
	{
		SWYM.pushEach(bodyExecutable, executable);
		if( theCurrentFunction.returnType !== undefined && theCurrentFunction.returnType.type !== "incomplete" )
		{
			if( theCurrentFunction.returnType.baked !== undefined && !SWYM.TypeMatches(theCurrentFunction.returnType, bodyReturnType) )
			{
				// force this return value (for Void, at least... but what about other baked types?)
				executable.push("#ClearStack");
				executable.push("#Literal");
				executable.push(theCurrentFunction.returnType.baked);
			}
			else
			{
				SWYM.TypeCoerce(theCurrentFunction.returnType, bodyReturnType, theFunction.bodyNode);
				returnType = SWYM.TypeIntersect(theCurrentFunction.returnType, bodyReturnType);
			}
		}
		else
		{
			returnType = bodyReturnType;
		}
	}
	
	if( theFunction.postExec !== undefined )
	{
		SWYM.pushEach(theFunction.postExec, executable);
	}
	
	return returnType;
}

SWYM.CScopeRedirect = function(cscope, argName)
{
	while ( cscope[argName] && cscope[argName].redirect )
	{
		argName = cscope[argName].redirect;
	}
	
	return argName;
}

// Despite the name, this just constructs a block type.
// The block itself doesn't get compiled yet.
SWYM.CompileLambda = function(braceNode, argNode, cscope, executable)
{
	var bodyText = braceNode.op.source.substring( braceNode.op.pos, braceNode.op.endSourcePos+1 );
	var debugName = bodyText;
	var argText = undefined;

	if( argNode !== undefined && argNode.op !== undefined && argNode.op.endSourcePos !== undefined )
	{
		argText = SWYM.GetSource(argNode.op.pos, argNode.op.endSourcePos+1);

		if( argNode !== undefined && argNode.op !== undefined && argNode.op.text === "(" && argNode.children[0] === undefined &&
			argNode.children[1] !== undefined )
		{
			// argument is parenthesized
			argNode = argNode.children[1];
		}
	}
		
	if( argNode !== undefined && argNode.type === "decl" )
	{
		if( argText === undefined )
		{
			argText = argNode.text;
		}
		var argName = argNode.value;
	}
	else
	{
		if( argText === undefined )
		{
			argText = "'it'";
		}
		var argName = "it";
	}
	
	if( argText !== undefined )
	{
		debugName = argText + "->" + debugName;
	}

	// The closureInfo object gets embedded into the executable. It contains the data used at
	// runtime to construct the actual closure/variable capture value.
	// (capturedNames lists the local/global variables that are captured from its scope
	// at creation time. It's currently empty - we'll populate this list if & when the closure
	// actually gets compiled. Typically when we find a call site. The executable will remain
	// undefined unless we find an ambiguous call site - i.e. one where we don't know at compile
	// time which block it's actually calling.)
	var closureInfo = { type:"closureInfo", capturedNames:[], executable:undefined, debugName:debugName, debugText:bodyText, argName:argName };

	executable.push("#Closure");
	executable.push(closureInfo);

	var blockType = {type:"type",
		debugName:"Block("+debugName+")",
		nativeType:"Closure", // TODO: should be "Block", it won't become a closure unless we call it ambiguously
		bodyText:bodyText,
		bodyNode:braceNode.children[1],
		needsCompiling: [{
			debugName:debugName,
			argNode:argNode,
			argName:argName,
			bodyNode:braceNode.children[1],
			cscope:cscope,
			closureInfo:closureInfo,
		}],
	};
	
	return blockType;
}

// This generates an executable from a block type. The block type's closureInfo
// will be modified if appropriate.
SWYM.CompileLambdaInternal = function(closureType, argType, executable, errorNode)
{
	if( !closureType.needsCompiling )
	{
		return SWYM.GetOutType(closureType, argType, errorNode);
	}

	if( closureType.needsCompiling.length == 1 )
	{
		return SWYM.CompileLambdaInternalEntry( closureType.needsCompiling[0], argType, executable, errorNode );
	}
	else
	{
		var returnType = undefined;
		for(var Idx = 0; Idx < closureType.needsCompiling.length; ++Idx )
		{
			returnType = SWYM.TypeUnify(returnType, SWYM.CompileLambdaInternalEntry( closureType.needsCompiling[Idx], argType, undefined, errorNode ));
		}
		return returnType;
	}
}

SWYM.CompileLambdaInternalEntry = function(compileInfo, argType, executable, errorNode)
{	
	var argNode = compileInfo.argNode;
	var cscope = compileInfo.cscope;
	var node = compileInfo.bodyNode;
	var closureInfo = compileInfo.closureInfo;
	
	if( executable === undefined )
	{
		if( closureInfo.executable !== undefined )
		{
			SWYM.LogError(errorNode, "Tried to recompile a block!");
		}
		
		// if we're not compiling a one-off executable, store it in the closureInfo.
		executable = [];
		closureInfo.executable = executable;
	}
	
	var innerCScope;
	
	if( argNode !== undefined && SWYM.TypeMatches(SWYM.VoidType, argType) )
	{
		SWYM.LogError(errorNode, "This block requires a non-Void argument.");
	}
		
	var innerCScope = object(cscope);
	var argName;

	// argument is parenthesized
	if( argNode !== undefined && argNode.op !== undefined && argNode.op.text === "(" && argNode.children[0] === undefined &&
		argNode.children[1] !== undefined )
	{
		argNode = argNode.children[1];
	}
	
	if( argNode !== undefined )
	{
		var requiredArgType = SWYM.GetTypeFromPatternNode( argNode, cscope );
		SWYM.TypeCoerce(requiredArgType, argType, argNode? argNode: node, "Block parameter type");
	}

	if( argNode !== undefined && argNode.type === "decl" )
	{
		argName = argNode.value;
		innerCScope["__default"] = undefined;
		innerCScope["it"] = undefined;
	}
	else if ( argNode !== undefined && argNode.op !== undefined && (argNode.op.text === "[" || argNode.op.text === "{") )
	{
		// destructuring an array/table arg
		argName = "it";
		innerCScope["__default"] = {redirect:"it"};
		
		executable.push("#Load");
		executable.push("it");

		SWYM.CompileDeconstructor(argNode, cscope, executable, argType);

		executable.push("#Pop");
	}
	else
	{
		argName = "it";
		innerCScope["__default"] = {redirect:"it"};

		if( argNode !== undefined && requiredArgType === undefined )
		{
			SWYM.LogError(argNode, "Don't understand argument name "+argNode);
			return {type:"novalues"};
		}
	}
	
	executable.unshift(argName);
	executable.unshift("#ArgStore");
	innerCScope[argName] = argType;

	var returnType = SWYM.CompileNode(node, innerCScope, executable);
	
	// a simple optimization for small executables: strip off the #ArgStore instruction if it's easy to do so.
	if( executable.length < 10 && executable[0] === "#ArgStore" )
	{
		var numArgLoads = 0;
		for( var Idx = executable.length-1; Idx >= 2; --Idx )
		{
			if( executable[Idx] === "#Load" && executable[Idx+1] === argName )
			{
				numArgLoads++;
			}
			else if( SWYM.ScopeAccessorInstructions[executable[Idx]] === true )
			{
				numArgLoads = -1;
				break;
			}
		}
		
		if( numArgLoads === 0 )
		{
			// this executable doesn't care about the argument passed in at all
			executable.shift();
			executable[0] = "#ClearStack";
		}
		else if( numArgLoads === 1 && executable[2] === "#Load" && executable[3] === argName )
		{
			// this executable loads its argument exactly once, at the beginning
			// so we might as well omit the #ArgStore and #Load instructions.
			executable.shift();
			executable.shift();
			executable.shift();
			executable.shift();
		}
	}
	
	// TODO: closureInfo should be populated with the executable, and the
	// list of variables that were captured from the containing scope.

	return returnType;
	
/*	executableBlock.argName = argName;
	executableBlock.body = bodyExecutable;

	//TODO: Blocks will probably want more members, such as "parseTree".
	var closureType = {type:"type",
		debugName:"Closure("+debugName+")",
		nativeType:"closure",
		argNode:argNode,
		bodyNode:braceNode.children[1],
		cscope:cscope,
		needsCompiling:true,
		closureInfo:closureInfo,
	};
	
	return closureType;
	return {type:"type",
		nativeType:"closure" argType:argType, outType:returnType, baked:executableBlock};
		*/
}

SWYM.CompileClosureCall = function(argType, argExecutable, closureType, closureExecutable, cscope, executable, errorNode)
{
	if( !closureType.needsCompiling )
	{
		SWYM.pushEach(argExecutable, executable);
		SWYM.pushEach(closureExecutable, executable);
		executable.push("#ClosureCall");
		return SWYM.GetOutType(closureType, argType, errorNode);
	}

	var numArgReferences = 0;
	var numClosureReferences = 0;
	var cannotInline = false;
	
	var bodyExecutable = [];
	var returnType = SWYM.CompileLambdaInternal(closureType, argType, bodyExecutable);

	if( closureType && closureType.baked && closureType.baked.body )
	{
		var closureBody = closureType.baked.body;

		// see if we can cheaply and safely inline this
		for( var Idx = 0; Idx < closureBody.length; ++Idx )
		{
			if( closureBody[Idx] === "#Load")
			{
				if( closureBody[Idx+1] === closureType.baked.argName )
				{
					++numArgReferences;
				}
				else
				{
					++numClosureReferences;
				}
			}
			else if( SWYM.ScopeAccessorInstructions[closureBody[Idx]] === true )
			{
				cannotInline = true;
			}
		}
	}
	else
	{
		cannotInline = true;
	}

	if( cannotInline || numArgReferences > 1 || numClosureReferences > 1 )
	{
		// not suitable for inlining
		/*if( numClosureReferences === 0 )
		{
			SWYM.pushEach(argExecutable, executable);
			executable.push("#FnCall");
			executable.push("DO:"+SWYM.TypeToString(closureType));
			executable.push([closureType.argName]);
			executable.push(bodyExecutable);
		}
		else
		{*/
			SWYM.pushEach(argExecutable, executable);
			SWYM.pushEach(closureExecutable, executable);
			executable.push("#ClosureExec");
			executable.push(bodyExecutable);
		//}
	}
	else
	{
		// insert the args into the executable body
		for( var Idx = 0; Idx < closureBody.length; ++Idx )
		{
			if( closureBody[Idx] === "#Load")
			{
				if( closureBody[Idx+1] === closureType.baked.argName )
				{
					SWYM.pushEach(argExecutable, executable);
					++Idx;
				}
				else
				{
					SWYM.pushEach(closureExecutable, executable);
					executable.push("#LoadFromClosure");
					executable.push(closureBody[Idx+1]);
					++Idx;
				}
			}
			else
			{
				executable.push(closureBody[Idx]);
			}
		}
	}
	
	return returnType;
}

SWYM.ScopeAccessorInstructions = {
	"#Store":true,
	"#Overwrite":true,
	"#Closure":true,
	"#Etc":true,
	"#EtcSequence":true,
	"#Return":true,
	"#IfElse":true,
};

// Compile deconstructing expressions such as ['x','y']->{ x+y }
// (well, only the part in square brackets.)
SWYM.CompileDeconstructor = function(templateNode, cscope, executable, argType)
{
	if( templateNode.type === "decl" )
	{
		executable.push("#Store");
		executable.push(templateNode.value);

		cscope[templateNode.value] = argType;
	}
	else if( templateNode.op && templateNode.op.text === ":" && templateNode.children[1] && templateNode.children[1].type === "decl" )
	{
		executable.push("#Store");
		executable.push(templateNode.children[1].value);

		//TODO: handle this explicit type declaration
		cscope[templateNode.children[1].value] = argType;
	}
	else if( templateNode.op && templateNode.op.text === "[" )
	{
		var opName = undefined;
		if( templateNode.children[1] && templateNode.children[1].op )
		{
			opName = templateNode.children[1].op.text;
		}

		if( opName === ".." )
		{
			// [first..last] range array deconstructor
			SWYM.CompileRangeDeconstructor(templateNode.children[1], false, false, cscope, executable, argType);
		}
		else if( opName === "..<" )
		{
			// [first..<exclude] range array deconstructor
			SWYM.CompileRangeDeconstructor(templateNode.children[1], false, true, cscope, executable, argType);
		}
		else if( opName === "<.." )
		{
			// [exclude<..last] range array deconstructor
			SWYM.CompileRangeDeconstructor(templateNode.children[1], true, false, cscope, executable, argType);
		}
		else if( opName === "<..<" )
		{
			// [exclude<..<exclude] range array deconstructor
			SWYM.CompileRangeDeconstructor(templateNode.children[1], true, true, cscope, executable, argType);
		}
		else
		{
			SWYM.CompileArrayDeconstructor(templateNode.children[1], 0, cscope, executable, argType);
		}
	}
	else if( templateNode.op && templateNode.op.text === "{" )
	{
		SWYM.CompileTableDeconstructor(templateNode.children[1], cscope, executable, argType);
	}
	else
	{
		//SWYM.LogError(templateNode, "Unexpected structure in argument declaration")
	}
}

SWYM.CompileRangeDeconstructor = function(rangeNode, overlapStart, overlapEnd, cscope, executable, argType)
{
	SWYM.TypeCoerce(SWYM.RangeArrayType, argType, rangeNode);
	
	if( rangeNode.children[0] !== undefined && rangeNode.children[1] !== undefined )
	{
		executable.push("#Dup");
	}
	
	if( rangeNode.children[0] !== undefined )
	{
		if( rangeNode.children[0].type !== "decl" )
		{
			SWYM.LogError(templateNode, "Unexpected expression in range deconstructor")
			return;
		}
		executable.push("#Native");
		executable.push(1);
		if( overlapStart )
			executable.push(function(rangeArray){ return rangeArray.first-1; });
		else
			executable.push(function(rangeArray){ return rangeArray.first; });
		executable.push("#Store");
		executable.push(rangeNode.children[0].value);
		executable.push("#Pop");

		cscope[rangeNode.children[0].value] = SWYM.IntType;
	}
	
	if( rangeNode.children[1] !== undefined )
	{
		if( rangeNode.children[1].type !== "decl" )
		{
			SWYM.LogError(templateNode, "Unexpected expression in range deconstructor")
			return;
		}
		executable.push("#Native");
		executable.push(1);
		if( overlapEnd )
			executable.push(function(rangeArray){ return rangeArray.last+1; });
		else
			executable.push(function(rangeArray){ return rangeArray.last; });
		executable.push("#Store");
		executable.push(rangeNode.children[1].value);
		executable.push("#Pop");

		cscope[rangeNode.children[1].value] = SWYM.IntType;
	}
}

SWYM.CompileArrayDeconstructor = function(templateNode, index, cscope, executable, argType)
{
	if( templateNode.op && (templateNode.op.text === "," || templateNode.op.text === ";" || templateNode.op.text === "(blank_line)") )
	{
		index = SWYM.CompileArrayDeconstructor(templateNode.children[0], index, cscope, executable, argType);
		index = SWYM.CompileArrayDeconstructor(templateNode.children[1], index, cscope, executable, argType);
		return index;
	}
	else
	{
		executable.push("#Dup");
		executable.push("#Literal");
		executable.push(index);
		executable.push("#At");
		SWYM.CompileDeconstructor(templateNode, cscope, executable, SWYM.GetOutType(argType, SWYM.BakedValue(index)));
		executable.push("#Pop");
		return index+1;
	}
}

SWYM.CompileTableDeconstructor = function(templateNode, cscope, executable, argType)
{
	if( templateNode.op && (templateNode.op.text === "," || templateNode.op.text === ";" || templateNode.op.text === "(blank_line)") )
	{
		SWYM.CompileTableDeconstructor(templateNode.children[0], cscope, executable, argType);
		SWYM.CompileTableDeconstructor(templateNode.children[1], cscope, executable, argType);
	}
	else if( templateNode.type === "decl" )
	{
		SWYM.CompileTableElementDeconstructor(SWYM.StringWrapper(templateNode.value), templateNode.value, cscope, executable, argType);
	}
	else if( templateNode.op && templateNode.op.text === ":" && templateNode.children[1] && templateNode.children[1].type === "decl" )
	{
		//TODO: handle this type declaration
		SWYM.CompileTableElementDeconstructor(
			SWYM.StringWrapper(templateNode.children[1].value),
			templateNode.children[1].value,
			cscope,
			executable,
			argType
		);
	}
	else if( templateNode.op && templateNode.op.text === ":" )
	{
		//Explicit table key
		var tempExecutable = [];
		var keyType = SWYM.CompileNode(templateNode.children[0], cscope, tempExecutable);
		if( !keyType || !keyType.baked )
		{
			SWYM.LogError(templateNode.children[0], "For destructuring arguments, table keys must be known at compile time.");
		}
		else
		{
			var rhs = templateNode.children[1];
			if( rhs.op && rhs.op.text === ":" && rhs.children[1] && rhs.children[1].type === "decl" )
			{
				// TODO: handle type declaration
				SWYM.CompileTableElementDeconstructor(keyType.baked, rhs.children[1].value, cscope, executable, argType);
			}
			else if( rhs.type === "decl" )
			{
				SWYM.CompileTableElementDeconstructor(keyType.baked, rhs.value, cscope, executable, argType);
			}
			else
			{
				SWYM.LogError(rhs, "Invalid table destructuring declaration.");
			}
		}
	}
	else
	{
		SWYM.LogError(templateNode, "Unexpected structure in argument table declaration")
	}
}

SWYM.CompileTableElementDeconstructor = function(readName, writeName, cscope, executable, argType)
{
	executable.push("#Dup");
	executable.push("#Literal");
	executable.push(readName);
	executable.push("#At");
	executable.push("#Store");
	executable.push(writeName);
	executable.push("#Pop");
	
	// TODO: get the specific type from the table, if available?
	cscope[writeName] = SWYM.GetOutType(argType);
}

SWYM.AddKeyAndValue = function(keyNode, valueNode, keyNodes, valueNodes)
{
	if( keyNode && keyNode.op && keyNode.op.text === ":" )
	{
		SWYM.AddKeyAndValue(keyNode.children[0], valueNode, keyNodes, valueNodes);
		SWYM.AddKeyAndValue(keyNode.children[1], valueNode, keyNodes, valueNodes);
	}
	else
	{
		keyNodes.push(keyNode);
		valueNodes.push(valueNode);
	}
}

SWYM.CollectKeysAndValues = function(node, keyNodes, valueNodes)
{
	if( node && node.op && (node.op.text === "," || node.op.text === ";" || node.op.text === "(blank_line)") )
	{
		SWYM.CollectKeysAndValues(node.children[0], keyNodes, valueNodes);
		SWYM.CollectKeysAndValues(node.children[1], keyNodes, valueNodes);
	}
	else if( node && node.op && node.op.text === ":" )
	{
		SWYM.AddKeyAndValue(node.children[0], node.children[1], keyNodes, valueNodes);
	}
	else if( node && node.op && node.op.text === "->" )
	{
		if( node.children[0] && node.children[0].type === "decl" )
		{
			SWYM.AddKeyAndValue(node.children[0], node.children[1], keyNodes, valueNodes);
		}
		else
		{
			var newDecl = SWYM.NewToken("decl", node.children[0].pos, "'it'", "it");
			newDecl.children[0] = node.children[0];
			SWYM.AddKeyAndValue(newDecl, node.children[1], keyNodes, valueNodes);
		}
	}
	else if( node && node.type === "decl" )
	{
		SWYM.AddKeyAndValue(node, undefined, keyNodes, valueNodes);
	}
	else if( node )
	{
		SWYM.LogError(node, "Error: each element of a table must be a 'key:value' declaration.");
	}
}

SWYM.AddClassMember = function(bodyNode, nameNodes, defaultValueNodes)
{
	if( bodyNode && bodyNode.op && bodyNode.op.text === "=" )
	{
		nameNodes.push(bodyNode.children[0]);
		defaultValueNodes.push(bodyNode.children[1]);
	}
	else
	{
		nameNodes.push(bodyNode);
		defaultValueNodes.push(undefined);
	}
}

SWYM.CollectClassMembers = function(node, nameNodes, defaultValueNodes)
{
	if( node && node.op && (node.op.text === "," || node.op.text === ";" || node.op.text === "(blank_line)") )
	{
		SWYM.CollectClassMembers(node.children[0], nameNodes, defaultValueNodes);
		SWYM.CollectClassMembers(node.children[1], nameNodes, defaultValueNodes);
	}
	else if( node && (node.type === "decl" || (node.op && node.op.text === "=")) )
	{
		SWYM.AddClassMember(node, nameNodes, defaultValueNodes);
	}
	else if( node )
	{
		SWYM.LogError(node, "Error: Expected a member declaration, got "+node.text+".");
	}
}

SWYM.ConvertSeparatorsToCommas = function(node)
{
	if( node && node.op && (node.op.text === ";" || node.op.text === "(blank_line)") )
	{
		node.op.behaviour = SWYM.operators[","];
		node.op.text = ",";
		node.children = [
			SWYM.ConvertSeparatorsToCommas(node.children[0]),
			SWYM.ConvertSeparatorsToCommas(node.children[1])
		]
	}
	
	return node;
}

SWYM.CompileTable = function(node, cscope, executable)
{
	if( node.type === "etc" )
	{
		return SWYM.CompileEtc(node, cscope, executable);
	}
	
	var keyNodes = [];
	var valueNodes = [];
	
	SWYM.CollectKeysAndValues(node, keyNodes, valueNodes);

	if( keyNodes.length != valueNodes.length )
	{
		SWYM.LogError(node, "Fsckup: inconsistent numbers of keys and values in table!?");
	}
	
	var elementExecutable = [];
	var bakedKeys = [];
	var bakedValues = [];
	var accessors = {};
	var commonKeyType = SWYM.DontCareType;
	var commonValueType = SWYM.DontCareType;
	var elseExecutable = undefined;
	var elseValue = undefined;
	
	var keysExecutable = [];
	var numKeys = 0;
	
	for( var idx = 0; idx < keyNodes.length; ++idx )
	{
		if( keyNodes[idx] && keyNodes[idx].type === "name" && keyNodes[idx].text === "else" )
		{
			if( elseExecutable === undefined )
			{
				elseExecutable = [];
				var elseType = SWYM.CompileNode(valueNodes[idx], cscope, elseExecutable);
				commonValueType = SWYM.TypeUnify(commonValueType, elseType);
				
				if( elseType && elseType.baked !== undefined )
				{
					elseValue = elseType.baked;
					commonValueType = SWYM.TypeUnify(commonValueType, elseType);
				}
				else
				{
					bakedValues = undefined;
				}
				continue;
			}
			else
			{
				SWYM.LogError(keyNodes[idx], "Table has too many 'else' clauses.");
				continue;
			}
		}
		
		var valueType;
		if( keyNodes[idx] && keyNodes[idx].type === "decl" )
		{
			var elementCScope = cscope;
			if( keyNodes[idx].value !== "it" )
			{
				var elementCScope = object(cscope);
				elementCScope[keyNodes[idx].value] = {redirect:"it"};
			}
			valueType = SWYM.CompileNode(valueNodes[idx], elementCScope, elementExecutable);
		}
		else
		{
			valueType = SWYM.CompileNode(valueNodes[idx], cscope, elementExecutable);
		}
		commonValueType = SWYM.TypeUnify(commonValueType, valueType);

		if( bakedValues )
		{
			if( valueType && valueType.baked !== undefined )
			{
				bakedValues[idx] = valueType.baked;
			}
			else
			{
				bakedValues = undefined;
			}
		}

		// handle single quoted 'declaration' keys
		if( keyNodes[idx] && keyNodes[idx].type === "decl" )
		{
			if( accessors[keyNodes[idx].value] !== undefined )
			{
				SWYM.LogError(keyNodes[idx], "Duplicate declaration of "+keyNodes[idx].text+" in this table.");
			}
			else
			{
				accessors[keyNodes[idx].value] = valueType;
			}

			// replace the declaration with a string literal
			keyNodes[idx] = SWYM.NewToken("literal", keyNodes[idx].pos, keyNodes[idx].text, keyNodes[idx].value);
		}

		var keyType = SWYM.CompileNode(keyNodes[idx], cscope, keysExecutable);
		commonKeyType = SWYM.TypeUnify(commonKeyType, keyType);
		
		numKeys++;
		
		if( bakedKeys === undefined || keyType === undefined || keyType.baked === undefined )
		{
			//SWYM.LogError(keyNodes[idx], "Table keys must be compile-time constants (at the moment).");
			bakedKeys = undefined;
		}
		else
		{
			bakedKeys[idx] = keyType.baked;
		}
		
		if( valueType && valueType.multivalueOf !== undefined )
			SWYM.LogError(valueNodes[idx], "Error: json-style object declarations may not contain multi-values.");
	}
	
	if( bakedKeys === undefined )
	{
		SWYM.pushEach(keysExecutable, executable);
		executable.push("#CreateArray");
		executable.push(numKeys);
		SWYM.pushEach(elementExecutable, executable);
		executable.push("#CreateArray");
		executable.push(numKeys);
		
		if( elseExecutable !== undefined )
		{
			executable.push("#Closure");
			executable.push({"type":"closureInfo", "argName":"it", "debugName":"else:"});
			executable.push("#Native");
			executable.push(3);
			executable.push(function(keys, values, elseClosure)
			{
				var contents = {};
				// NB inserting the values in reverse order, so that the first listed items take precedence
				for(var Idx = numKeys-1; Idx >= 0; --Idx )
				{
					contents[ SWYM.ToTerseString(keys[Idx]) ] = values[Idx];
				}
				
				return {type:"table",
					run:function(key)
					{
						var result = this.jsTable[ SWYM.ToTerseString(key) ];				
						if( result !== undefined )
						{
							return result;
						}
						else
						{
							return SWYM.ClosureExec(elseClosure, key, elseExecutable);
						}
					},
					keys:keys,
					jsTable:contents,
				}
			});
		}
		else
		{			
			executable.push("#Native");
			executable.push(2);
			executable.push(function(keys, values)
			{
				var contents = {};
				// NB inserting the values in reverse order, so that the first listed items take precedence
				for(var Idx = numKeys-1; Idx >= 0; --Idx )
				{
					contents[ SWYM.ToTerseString(keys[Idx]) ] = values[Idx];
				}
				
				return {type:"table",
					run:function(key)
					{
						var result = this.jsTable[ SWYM.ToTerseString(key) ];				
						if( result !== undefined )
							return result;

						SWYM.LogError(-1, "Invalid table lookup. No key equals "+SWYM.ToDebugString(key));
					},
					keys:keys,
					jsTable:contents,
				}
			});
		}
		
		var resultType = SWYM.TableTypeFromTo(commonKeyType, commonValueType, accessors);
	}
	else
	{
		bakedKeys = SWYM.jsArray(bakedKeys);
	
		if( SWYM.TypeMatches(SWYM.StringType, commonKeyType) )
		{
			var constructor = function(values, els)
			{
				var table = {};
				for( var Idx = 0; Idx < values.length; ++Idx )
				{
					table[ SWYM.ToTerseString(bakedKeys[Idx]) ] = values.run(Idx);
				}
				
				return {type:"table",
					run:function(key)
					{
						var result = this.jsTable[ SWYM.ToTerseString(key) ];				
						if( result !== undefined )
							return result;

						if( this.elseValue !== undefined )
							return this.elseValue;
						else
							SWYM.LogError(-1, "Invalid table lookup. No key equals "+SWYM.ToDebugString(key));
					},
					keys:bakedKeys,
					jsTable:table,
					elseValue:els
				}
			};
		}
		else if( SWYM.TypeMatches(SWYM.NumberType, commonKeyType) )
		{
			var constructor = function(values, els)
			{
				var table = {};
				for( var Idx = 0; Idx < values.length; ++Idx )
				{
					table[bakedKeys[Idx]] = values.run(Idx);
				}
				
				return {type:"table",
					run:function(key)
					{
						var result = this.jsTable[key];				
						if( result !== undefined )
							return result;
						
						if( this.elseValue !== undefined )
							return this.elseValue;
						else
							SWYM.LogError(-1, "Invalid table lookup. No key equals "+SWYM.ToDebugString(key));
					},
					keys:bakedKeys,
					jsTable:table,
					elseValue:els
				}
			};
		}
		else
		{
			var constructor = function(values, els)
			{
				return {type:"table",
					run:function(key)
					{
						// not very happy with this. Use a hash.
						for( var idx = 0; idx < this.keys.length; ++idx )
						{
							if( SWYM.IsEqual(this.keys.run(idx), key) )
							{
								return this.values[idx];
							}
						}
						// FIXME: should give an out of bounds error
						if( this.elseValue !== undefined )
							return this.elseValue;
						else
							SWYM.LogError(-1, "Invalid table lookup. No key equals "+SWYM.ToDebugString(key));
					},
					keys:bakedKeys,
					values:values,
					elseValue:els
				}
			};
		}
	
		if ( bakedValues !== undefined && (elseType === undefined || elseType.baked !== undefined) )
		{
			var bakedTable = constructor(SWYM.jsArray(bakedValues), elseValue);

			executable.push("#Literal");
			executable.push(bakedTable);
			
			var resultType;
			if( elseValue !== undefined )
				resultType = SWYM.TableTypeFromTo(SWYM.AnythingType, commonValueType, accessors);
			else
				resultType = SWYM.TableTypeFromTo(commonKeyType, commonValueType, accessors);
				
			resultType.baked = bakedTable;
		}
		else if ( elseExecutable !== undefined )
		{
			SWYM.pushEach(elseExecutable, executable);
			SWYM.pushEach(elementExecutable, executable);
			executable.push("#Native");
			executable.push(bakedKeys.length+1);
			executable.push(function()
			{
				var args = Array.prototype.slice.call(arguments);
				var elseValue = args[0];
				args.shift();
				return constructor(SWYM.jsArray(args), elseValue);
			});
			
			// TODO: What if the else executable doesn't actually accept AnythingType?
			// Defer compilation of the else executable so that we know what argument type is being passed?
			var resultType = SWYM.TableTypeFromTo(SWYM.AnythingType, commonValueType, accessors);
		}
		else
		{
			SWYM.pushEach(elementExecutable, executable);
			executable.push("#Native");
			executable.push(bakedKeys.length);
			executable.push(function()
			{
				var args = Array.prototype.slice.call(arguments);
				return constructor(SWYM.jsArray(args), undefined);
			});
			
			var resultType = SWYM.TableTypeFromTo(commonKeyType, commonValueType, accessors);
		}
	}
		
	return resultType;
}


SWYM.CompileClassBody = function(node, cscope, defaultValueTable)
{
	var nameNodes = [];
	var defaultValueNodes = [];
	
	SWYM.CollectClassMembers(node, nameNodes, defaultValueNodes);

	if( nameNodes.length !== defaultValueNodes.length )
	{
		SWYM.LogError(node, "Fsckup: inconsistent number of names and values in struct!?");
	}
	
	var memberTypes = {};
	var unusedExecutable = [];
	
	for( var idx = 0; idx < nameNodes.length; ++idx )
	{		
		if( !nameNodes[idx] )
		{
			SWYM.LogError(node, "Invalid member declaration - missing name");
		}
		else if( nameNodes[idx].type !== "decl" )
		{
			SWYM.LogError(node, "Invalid member declaration "+nameNodes[idx]);
		}
		else
		{
			var memberName = nameNodes[idx].value;

			defaultValueTable[memberName] = defaultValueNodes[idx];
			
			var typeNode = nameNodes[idx].children === undefined? undefined: nameNodes[idx].children[0];
			if( typeNode === undefined )
			{
				memberTypes[memberName] = undefined;
			}
			else
			{
				var typeType = SWYM.CompileNode(typeNode, cscope, unusedExecutable);

				if( !typeType || !typeType.baked || typeType.baked.type !== "type" )
				{
					SWYM.LogError(typeNode, "Type declaration for "+memberName+" is not a valid type!");
				}
				else
				{
					memberTypes[memberName] = typeType.baked;
				}
			}
		}
	}
	
	return memberTypes;
}

SWYM.CompileEtc = function(parsetree, cscope, executable)
{
	var isTable = ( parsetree.baseCase.op && parsetree.baseCase.op.text === ":" );
/*	if( parsetree.body.etcExpandAround !== undefined )
	{
		//To do an ExpandAround, the body must be parsed into a function that
		//we can apply multiple times.
		var baseType = SWYM.CompileNode(parsetree.body.children[parsetree.body.etcExpandAround], cscope, etcExecutable);
		
		var baseNode = parsetree.body.children[parsetree.body.etcExpandAround];
		parsetree.body.children[parsetree.body.etcExpandAround] = SWYM.NewToken("name", baseNode.pos, "<prevEtc>");

		var stepCScope = object(cscope);
		stepCScope["<prevEtc>"] = baseType;
		
		stepExecutable = [];
		var bodyType = SWYM.CompileNode(parsetree.body, stepCScope, stepExecutable);			
	}
	else if( parsetree.body.op && parsetree.body.op.text === ":" )
	{
		var keyType = SWYM.CompileNode(parsetree.body.children[0], cscope, etcExecutable);
		var valueType = SWYM.CompileNode(parsetree.body.children[1], cscope, etcExecutable);
		bodyType = SWYM.TableTypeFromTo(keyType, valueType);
		etcExecutable.push("#CreateArray");
		etcExecutable.push(2);
	}
	else*/
//	{
//	}

	var haltExecutable = [];
	var haltCondition = undefined;
	var limitTimesExecutable = undefined;
	
	if( parsetree.etcType === "etc**" )
	{
		limitTimesExecutable = [];
		var limitType = SWYM.CompileNode(parsetree.rhs, cscope, limitTimesExecutable);
		SWYM.TypeCoerce(SWYM.IntType, limitType, parsetree, "etc** number of times");
	}
	else if( parsetree.rhs )
	{
		SWYM.CompileNode(parsetree.rhs, cscope, haltExecutable);

		if( parsetree.etcType === "etc..<" )
		{
			haltCondition = function(value, haltValue){ return value >= haltValue; }
		}
		else if( parsetree.etcType === "etc..<=" )
		{
			haltCondition = function(value, haltValue){ return value > haltValue; }
		}
		else if( parsetree.etcType !== "etc" )
		{
			haltCondition = function(value, haltValue){ if( SWYM.IsEqual(value, haltValue) ){ SWYM.g_etcState.halt = true; } return false; }
		}
		else
		{
			SWYM.LogError(parsetree, "Fsckup: can't have a rhs on a "+parsetree.op.etc);
		}
	}

	var baseCaseExecutable = [];
	var baseCaseType;
	if( isTable )
	{
		var baseKeyType = SWYM.CompileNode(parsetree.baseCase.children[0], cscope, baseCaseExecutable);
		var baseValueType = SWYM.CompileNode(parsetree.baseCase.children[1], cscope, baseCaseExecutable);
		baseCaseExecutable.push("#CreateArray");
		baseCaseExecutable.push(2);
		baseCaseType = SWYM.TableTypeFromTo(baseKeyType, baseValueType);
	}
	else
	{
		baseCaseType = SWYM.CompileNode(parsetree.baseCase, cscope, baseCaseExecutable);
	}

	var etcScope = object(cscope);
	etcScope["<etcSoFar>"] = baseCaseType;

	if( parsetree.body.type === "fnnode" )
	{
		// Handle recursive function calls. This includes function-operators, such as + - * /
		var etcExecutable = [];
		var bodyType = SWYM.CompileNode(parsetree.body, etcScope, etcExecutable);

		if( parsetree.mergedBaseCase )
		{
			// there's no base case provided, so we'll use the function's identity value instead.
			baseCaseExecutable = ["#Literal", SWYM.GetFunctionIdentity(parsetree.body, etcScope)];
		}
	
		// main executable needs to initialize etcSoFar.
		SWYM.pushEach(baseCaseExecutable, executable);		
		executable.push("#Store");
			executable.push("<etcSoFar>");
		
		executable.push("#Pop");
		
		executable.push("#EtcSimple");
			executable.push(limitTimesExecutable);
			executable.push(etcExecutable);
			executable.push(haltExecutable);
			executable.push(haltCondition);

		executable.push("#Load");
			executable.push("<etcSoFar>");

		// etcExecutable needs to write its result to <etcSoFar>.
//		etcExecutable.push("#Overwrite");
//			etcExecutable.push("<etcSoFar>");

		return bodyType;
	}

	// it's not a function, so body must be an operator node
	var initialExecutable;
	var initialType;
	if( parsetree.mergedBaseCase )
	{
		initialExecutable = ["#Native", 0, parsetree.body.op.behaviour.identity];
	}
	else
	{
		initialExecutable = baseCaseExecutable;
		initialType = baseCaseType;
	}
	
	var composer = parsetree.body.op.behaviour.infix;

	var postProcessor = function(v){return v;}; // null postprocessor
	var returnType = parsetree.body.op.behaviour.returnType;

	var etcExecutable = [];
	if( isTable )
	{
		// table constructor
		var keyType = SWYM.CompileNode(parsetree.body.children[1].children[0], etcScope, etcExecutable);
		var valueType = SWYM.CompileNode(parsetree.body.children[1].children[1], etcScope, etcExecutable);
		etcExecutable.push("#CreateArray");
		etcExecutable.push(2);

		//FIXME: don't bother doing ToDebugString on string values?
		// also, it might be nice to make this work lazily?
		initialExecutable = ["#Native", 0, function(){ return {values:[], keys:[]}; }];
		composer = function(fields, pair)
		{
			// O(N-squared) algorithm for excluding duplicates. :-/ Change to hashtable?
			var foundIdx = -1;
			for(var Idx = 0; Idx < fields.keys.length; ++Idx)
			{
				if( SWYM.IsEqual(fields.keys[Idx], pair[0]) )
				{
					foundIdx = Idx;
					break;
				}
			}
			if( foundIdx === -1 )
			{
				fields.keys.push(pair[0]);
				fields.values.push(pair[1]);
			}
			else
			{
				fields.values[foundIdx] = pair[1];
			}
			return fields;
		};
		postProcessor = function(fields){ return SWYM.CreateTable(fields.keys, fields.values); };
		returnType = SWYM.TableTypeFromTo(SWYM.TypeUnify(baseKeyType, keyType), SWYM.TypeUnify(baseValueType, valueType));
	}
	else
	{
		var elementType = SWYM.CompileNode(parsetree.body.children[1], etcScope, etcExecutable);
		
		if( returnType === undefined && parsetree.body.op.behaviour.getReturnType )
		{
			returnType = parsetree.body.op.behaviour.getReturnType(bodyType, bodyType);
		}
		// most interesting operators are overloadable (i.e. treated as fnnodes), so there are
		// only a few things we need to handle here. Namely: , && ||
		switch(parsetree.body.op.text)
		{
			case ",": case ";": case "(blank_line)":
				if( initialType !== undefined )
				{
					initialExecutable.push( ( initialType.multivalueOf !== undefined )? "#CopyArray": "#SingletonArray");
				}
				
				if( limitTimesExecutable === undefined &&
						haltCondition === undefined &&
						(parsetree.etcType === "etc.." || parsetree.etcType === "etc," || parsetree.etcType === "etc;") )
				{
					// lazy array constructor
					// FIXME: need a way to detect out-of-bounds termination
					executable.push("#Closure");
					executable.push({
						type:"closureInfo",
						debugName:"lazy etc",
						debugText:"<etc expression>", //FIXME
						argName:"<etcIndex>",
						body:etcExecutable // This won't actually work
					});
					executable.push("#Native");
					executable.push(1)
					executable.push(function(lookup)
					{
						return{
							type:"lazyArray",
							length:Infinity,
							run:function(key){ return SWYM.ClosureCall(lookup,key); }
						};
					});
					
					return SWYM.ToMultivalueType(elementType, undefined, undefined, SWYM.BakedValue(Infinity));
				}
				else
				{
					// eager array constructor
					postProcessor = function(list){ return SWYM.jsArray(list); };
					
					if( elementType && elementType.multivalueOf !== undefined )
					{
						composer = function(list, v){ SWYM.ConcatInPlace( list, v ); return list; };
						returnType = SWYM.ToMultivalueType(elementType.multivalueOf);
					}
					else
					{
						composer = function(list, v){list.push(v); return list;};
						returnType = SWYM.ToMultivalueType(elementType);
					}
				}
				break;

			case "&&":
				SWYM.TypeCoerce(SWYM.BoolType, elementType, parsetree, "&&etc arguments");
				if( elementType && elementType.multivalueOf !== undefined )
				{
					composer = function(tru, v)
					{
						var result = SWYM.ResolveBool_Every(v);
						if(!result){ SWYM.g_etcState.halt = true; };
						return result;
					};
				}
				else
				{
					composer = function(tru, v)
					{
						if(!v){ SWYM.g_etcState.halt = true; };
						return v;
					};
				}
				break;

			case "||":
				SWYM.TypeCoerce(SWYM.BoolType, elementType, parsetree, "||etc arguments");
				if( elementType && elementType.multivalueOf !== undefined )
				{
					composer = function(fals, v)
					{
						var result = SWYM.ResolveBool_Some(v);
						if(result){ SWYM.g_etcState.halt = true; };
						return result;
					};
				}
				else
				{
					composer = function(fals, result)
					{
						if(result){ SWYM.g_etcState.halt = true; };
						return result;
					};
				}
				break;
				
			default:
				SWYM.LogError(parsetree, "Operator "+parsetree.body.op.text+" cannot be used in etc expressions!");
				return SWYM.DontCareType;
		}
	}
		
	executable.push("#Etc");
	executable.push(limitTimesExecutable);
	executable.push(etcExecutable);
	executable.push(initialExecutable);
	executable.push(composer);
	executable.push(postProcessor);
	executable.push(haltExecutable);
	executable.push(haltCondition);
	return returnType;
}

SWYM.GetFunctionIdentity = function(parsetree, cscope)
{
	var unusedExecutable = [];
	var chosenFunction = {};
	SWYM.CompileFunctionCall(parsetree, cscope, unusedExecutable, chosenFunction);
	
	if( chosenFunction.theFunction === undefined )
	{
		SWYM.LogError(parsetree, "Function "+parsetree.name+" is unknown!");
	}
	else
	{
		var identityArg = chosenFunction.theFunction.expectedArgs["__identity"];
		if( identityArg === undefined || identityArg.defaultValueNode === undefined )
		{
			SWYM.LogError(parsetree, "Function "+parsetree.name+" can't be used in etc expressions because it has no default argument named __identity.");
		}
		else
		{
			var identityType = SWYM.CompileNode(identityArg.defaultValueNode, cscope, []);
			if( !identityType || identityType.baked === undefined )
			{
				SWYM.LogError(identityArg.defaultValueNode, "Function "+parsetree.name+" __identity argument has no default value");
			}
			else
			{
				return identityType.baked;
			}
		}
	}
	
	return undefined;
}

SWYM.pushEach = function(from, into)
{
	if( into === undefined || from === undefined )
	{
		SWYM.LogError(0, "Fsckup: invalid pushEach");
		return;
	}
	for( var Idx = 0; Idx < from.length; Idx++ )
	{
		into.push( from[Idx] );
	}
}

SWYM.pushFrontEach = function(from, into)
{
	for( var Idx = from.length-1; Idx >= 0; Idx-- )
	{
		into.unshift( from[Idx] );
	}
}

SWYM.Each = function(list, body)
{
	var result = [];
	for( var Idx = 0; Idx < list.length; Idx++ )
	{
		result.push( body(list[Idx]) );
	}
	return result;
}

SWYM.selectiveClone = function(basis, members)
{
	var result = {};
	SWYM.selectiveCopy(basis, result, members);
	return result;
}

SWYM.selectiveCopy = function(from, into, members)
{
	for( var Idx = 0; Idx < members.length; Idx++ )
	{
		var member = members[Idx];
		
		if( from[member] !== undefined )
			into[member] = from[member];
	}
}

SWYM.DeclareAccessor = function(memberName, classType, memberType, cscope)
{
	SWYM.AddFunctionDeclaration("fn#"+memberName, cscope,
		{
			expectedArgs:{"this":{index:0, typeCheck:classType}},
			customCompile:function(argTypes, cscope, executable, errorNode)
			{
				if( argTypes[0] && argTypes[0].multivalueOf !== undefined )
				{
					executable.push("#MultiNative");
				}
				else
				{
					executable.push("#Native");
				}
				executable.push(1);
				executable.push(function(obj){ return obj.members[memberName]; });

				var structType;
				if( argTypes[0] && argTypes[0].multivalueOf )
					structType = argTypes[0].multivalueOf;
				else
					structType = argTypes[0];

				if( structType && structType.memberTypes && structType.memberTypes[memberName] )
				{
					return structType.memberTypes[memberName];
				}
				else
				{
					return memberType;
				}
			},
		});
}

SWYM.DeclareMutator = function(memberName, classType, memberType, cscope)
{
	SWYM.AddFunctionDeclaration("fn#"+memberName, cscope,
		{
			expectedArgs:{"this":{index:0, typeCheck:classType}, "__mutator":{index:1, typeCheck:SWYM.CallableType}},
			customCompile:function(argTypes, cscope, executable, errorNode)
			{
				var mutatorExecutable = [];
				var mutatorType = SWYM.CompileLambdaInternal(SWYM.ToSinglevalueType(argTypes[1]), memberType, mutatorExecutable, errorNode);
				
				if( !SWYM.TypeMatches(memberType, mutatorType) )
				{
					return "Cannot store values of type "+SWYM.TypeToString(mutatorType)+" in a variable of type "+SWYM.TypeToString(memberType);
				}
				
				executable.push("#Native");
				executable.push(2);
				executable.push
				(
					function(obj, mutator)
					{
						obj.members[memberName] = SWYM.ClosureExec( mutator, obj.members[memberName], mutatorExecutable );
					}
				);

				return SWYM.VoidType;
			},
		});
}

SWYM.DeclareNew = function(newStruct, defaultNodes, declCScope)
{
	var memberNames = [];
	var functionData = {
			expectedArgs:{"this":{index:0, typeCheck:SWYM.BakedValue(newStruct)}},
			bakeOutArgs:{0:true},
			nativeCode:function(/*...args...*/)
			{
				var members = {};
				for( var Idx = 0; Idx < memberNames.length; ++Idx )
				{
					members[memberNames[Idx]] = arguments[Idx];
				}
				return {type:"struct", isMutable:newStruct.isMutable, debugName:SWYM.TypeToString(newStruct), structType:newStruct, members:members};
			},
			getReturnType:function(argTypes)
			{
				var memberTypes = {};
				for( var Idx = 0; Idx < memberNames.length; ++Idx )
				{
					memberTypes[memberNames[Idx]] = argTypes[Idx+1];
				}
				
				var resultType = object(newStruct);
				resultType.memberTypes = memberTypes;
				return resultType;
			}
		};
	
	var nextIndex = 0;
	for( var memberName in newStruct.memberTypes )
	{
		functionData.expectedArgs[memberName] = {index:nextIndex+1, typeCheck:newStruct.memberTypes[memberName], defaultValueNode:defaultNodes[memberName], explicitNameRequired:true};
		memberNames[nextIndex] = memberName;
		nextIndex++;
	}

	SWYM.AddFunctionDeclaration("fn#new", declCScope, functionData);
}

SWYM.CreateLocal = function(declName, valueType, cscope, executable, errorNode)
{
	// the initial value is assumed to be already on the stack
//	if( valueType && valueType.multivalueOf !== undefined )
//	{
//		executable.push( "#ForceSingleValue" );
//		valueType = SWYM.ToSinglevalueType(valueType);
//	}
		
	executable.push( "#Store" );
	executable.push( declName );

	if( cscope[declName] !== undefined )
	{
		SWYM.LogError(errorNode, "Redefinition of \""+declName+"\"");
	}
	else
	{
		cscope[declName] = valueType;
	}

	// If this just declared a type, name the type after this variable name
	if( valueType && valueType.baked && valueType.baked.type === "type" && !valueType.baked.debugName )
	{
		valueType.baked.debugName = declName;
	}
}

SWYM.CompileMutableTable = function(keyType, valueType, defaultClosureExecutable, defaultClosureType, executable, errorNode)
{
	var defaultExecutable = [];
	var defaultResultType = SWYM.CompileLambdaInternal(defaultClosureType, keyType, defaultExecutable, errorNode);
	if(valueType === undefined)
		valueType = defaultResultType;
	else
		SWYM.TypeCoerce(valueType, defaultResultType, errorNode);

	SWYM.pushEach(defaultClosureExecutable, executable);
	executable.push("#Native");
	executable.push(1);
	executable.push( function(defaultClosure)
	{
		return {
			type:"table",
			jsTable:{},
			keys:SWYM.jsArray([]),
			run:function(key)
			{
				var keyStr = SWYM.ToTerseString(key);
				var result = this.jsTable[ keyStr ];				
				if( result === undefined )
				{
					result = SWYM.ClosureExec(defaultClosure, key, defaultExecutable);
					this.jsTable[ keyStr ] = result;
					this.keys.push(key);
				}
				return result;
			}
		}
	} );

	return SWYM.TableTypeFromTo(keyType, valueType, true);
}

SWYM.onLoad("swymCompile.js");