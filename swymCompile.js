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
				SWYM.DisplayOutput(value.data);
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
	else if ( parsetree.type === "etc" )
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
			if( parsetree.etcSequence.integer )
				return SWYM.IntType;
			else
				return SWYM.NumberType;
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
			SWYM.LogError(parsetree, "Unknown identifier \""+parsetree.text+"\".");
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
			return SWYM.CompileFunctionDeclaration("fn#"+parsetree.name, parsetree.argNames, parsetree.children, parsetree.body, cscope, executable);
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
				return SWYM.ToMultivalueType(SWYM.NoValuesType);
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
}

SWYM.CompileNode = function(node, cscope, executable)
{
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
	// This slightly dodgy test checks for an array of StringChars.
	// NB: Semantically, both String and StringChar behave as arrays of StringChars. So exclude them explicitly.
	if( testType && testType !== SWYM.StringType && testType !== SWYM.StringCharType &&
		testType.baked === undefined && testType.outType &&	testType.outType === SWYM.StringCharType &&
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
			resultType = SWYM.StringType;
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

SWYM.CompileFunctionCall = function(fnNode, cscope, executable)
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

		if( SWYM.TypeMatches(SWYM.VoidType, inputType) )
		{
			SWYM.LogError(args[inputArgName], "Got a Void argument ("+inputArgName+") while calling '"+fnName+"'");
		}
		
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
		return;
	}
	
	var validOverloads = [];
	var bestError = undefined;
	var bestErrorQuality = -1;
		
	for( var Idx = 0; Idx < overloads.length; ++Idx )
	{
		var overloadResult = SWYM.TestFunctionOverload(fnName, args, cscope, overloads[Idx], isMulti, inputArgTypes, inputArgExecutables);
		
		if( overloadResult.error === undefined )
		{
			validOverloads.push(overloadResult);
		}
		else if( bestErrorQuality < overloadResult.quality )
		{
			bestError = overloadResult.error;
			bestErrorQuality = overloadResult.quality;
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
		SWYM.LogError(fnNode, bestError);
		return;
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

// returns {error:<an error>, executable:<an executable>, returnType:<a return type>}
SWYM.TestFunctionOverload = function(fnName, args, cscope, theFunction, isMulti, inputArgTypes, inputArgExecutables)
{
	var overloadResult = {theFunction:theFunction, error:undefined, executable:[], typeChecks:{}, returnType:undefined, quality:0};

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
			
			// The # and 'else' arguments can only be provided by name.
			// The 'this' argument can only be provided anonymously if there are no other arguments.
			if( args[positionalArgName] !== undefined &&
					expectedArgName !== "#" &&
					expectedArgName !== "else" &&
					(expectedArgName !== "this" || hasOnlyThis))
			{
				inputArgNameList[expectedArgIndex] = positionalArgName;
				++nextPositionalArg;
			}
			else if( theFunction.expectedArgs[expectedArgName].defaultValueNode === undefined )
			{
				overloadResult.error = "Expected argument '"+expectedArgName+"' not found when calling function '"+fnName+"'";
				overloadResult.quality = 10; // very bad match
				return overloadResult;
			}
		}
		else
		{
			inputArgNameList[expectedArgIndex] = expectedArgName;
		}

		var inputArgName = inputArgNameList[expectedArgIndex];
		if( inputArgName !== undefined ) // undefined = default parameter
		{
			var expectedArgTypeCheck = theFunction.expectedArgs[expectedArgName].typeCheck;
			if( expectedArgTypeCheck && inputArgTypes[inputArgName] )
			{
				overloadResult.typeChecks[inputArgName] = expectedArgTypeCheck;
				if( !SWYM.TypeMatches(expectedArgTypeCheck, inputArgTypes[inputArgName]) )
				{
					if( inputArgName !== expectedArgName )
					{
						overloadResult.error = "Positional argument "+inputArgName+" was the wrong type for parameter \""+expectedArgName+"\" during call to function '"+fnName+"'. (Expected "+SWYM.TypeToString(expectedArgTypeCheck)+", got "+SWYM.TypeToString(inputArgTypes[inputArgName])+")";
					}
					else
					{
						overloadResult.error = "Argument '"+expectedArgName+"' was the wrong type during call to function '"+fnName+"'. (Expected "+SWYM.TypeToString(expectedArgTypeCheck)+", got "+SWYM.TypeToString(inputArgTypes[inputArgName])+")";
					}
					overloadResult.quality = 100; // pretty good match - just the wrong type
					return overloadResult;
				}
			}
		}
	}
	
	// make sure there are no extraneous args
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
			overloadResult.error = "Unexpected argument '"+remainingArgName+"' during call to function '"+fnName+"'.";
			overloadResult.quality = 5; // terrible match: extraneous arguments are unlikely to be an accident
			return overloadResult;
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
			overloadResult.error = typeCheckResult;
			overloadResult.quality = 120; // pretty good match, just failed at the last hurdle
			return overloadResult;
		}
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
				SWYM.LogError(0, "Fsckup: Missing argExecutable for arg name '"+inputArgName+"'");
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
			resultType = theFunction.customCompile(finalArgTypes, cscope, executable, customArgExecutables);
		}
		else
		{
			//NB: multiCustomCompile is a special compile mode that takes raw multivalues (and/or normal values) as input.
			resultType = theFunction.multiCustomCompile(finalArgTypes, cscope, executable, customArgExecutables);
			didMultiCustomCompile = true;
		}
	}
	else if ( theFunction.customCompile || theFunction.nativeCode )
	{
		if( theFunction.customCompile )
		{
			resultType = theFunction.customCompile(finalArgTypes, cscope, executable, customArgExecutables);
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
		
		if( precompiled.executable === undefined )
		{
			var bodyCScope = object(SWYM.MainCScope);
			for( var Idx = 0; Idx < argNamesPassed.length; Idx++ )
			{
				bodyCScope[argNamesPassed[Idx]] = argTypesPassed[Idx];
			}
			bodyCScope["__default"] = {redirect:"this"};

			precompiled.executable = [];
			precompiled.returnType = SWYM.NoValuesType; // treat recursive calls as though they yield our least offensive type.
			precompiled.isCompiling = true;
			precompiled.returnType = SWYM.CompileFunctionBody(theFunction, bodyCScope, precompiled.executable);
			precompiled.isCompiling = false;
			
			/*if( precompiled.isRecursive )
			{
				// if it's a recursive function, recompile now that we have proper type information.
				precompiled.executable.clear();
				precompiled.isCompiling = true;
				precompiled.returnType = SWYM.CompileFunctionBody(theFunction, bodyCScope, precompiled.executable);
				precompiled.isCompiling = false;
			}*/
		}
		else if( precompiled.isCompiling )
		{
			precompiled.isRecursive = true;
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

	var mustCompile = false;
	// if any of the arguments need compiling, it's not precompiled!
	for( var AIdx = 0; AIdx < argTypes.length; ++AIdx )
	{
		aType = argTypes[AIdx];
		while( aType && aType != SWYM.StringCharType )
		{
			if( aType.needsCompiling )
			{
				mustCompile = true;
				break;
			}
			aType = aType.outType;
		}
	}

	if( !mustCompile )
	{
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
	}
	
	var result = { types:argTypes };
	theFunction.precompiled.push(result);
	return result;
}

SWYM.CompileFunctionDeclaration = function(fnName, argNames, argTypes, body, cscope, executable)
{
	if( fnName === "fn#ref" )
	{
		SWYM.LogError(body, "The 'ref' function cannot be redefined.");
		return;
	}
	
//	var bodyCScope = object(cscope);
	var bodyExecutable = [];
	var bodyScope = object(cscope);
	
	var expectedArgs = {};

	for( var argIdx = 0; argIdx < argNames.length; ++argIdx )
	{
//		var typeCheck = {type:"value", canConstrain:true};
		var finalName = argNames[argIdx];
		var argNode = argTypes[argIdx];
		var defaultValueNode = undefined;
		
		if( argNode.op && argNode.op.text === "(" && !argNode.children[0] )
		{
			argNode = argNode.children[1];
		}
		else if( argNode.op && argNode.op.text === ":" )
		{
			argNode = argNode.children[0];
		}

		if( argNode.op && argNode.op.text === "=" )
		{
			defaultValueNode = argNode.children[1];
			argNode = argNode.children[0];
		}
		
		if ( argNode.type === "node" && argNode.op.text === "[" )
		{
			// deconstructing arg
			expectedArgs[finalName] = {finalName:finalName, index:argIdx, deconstructNode:argNode};//, typeCheck:typeCheck};
		}
		else if( argNode.type !== "decl" )
		{
			var typeCheckType = SWYM.GetTypeFromExpression(argNode, cscope);

			if( typeCheckType === undefined && argNode !== undefined )
			{
				SWYM.LogError(argNode, "Invalid type expression");
			}

			expectedArgs[finalName] = {finalName:finalName, index:argIdx, typeCheck:typeCheckType};
		}
		else
		{
			// simple untyped declaration
			expectedArgs[finalName] = {finalName:finalName, index:argIdx};
		}
		
		if( defaultValueNode )
		{
			expectedArgs[finalName].defaultValueNode = defaultValueNode;
		}

//		bodyCScope[finalName] = typeCheck;
//		typeCheck.template = ["@ArgTypeNamed", finalName];
	}

	var cscopeFunction = {
		bodyNode:body,
		expectedArgs:expectedArgs,
		executable:bodyExecutable,
//		bodyCScope:bodyCScope, // used by implicit member definitions, like 'Yielded'.
		toString: function(){ return "'"+fnName+"'"; },
		returnType: {type:"incomplete"}
	};

	SWYM.AddFunctionDeclaration(fnName, cscope, cscopeFunction);
	
	var negateExecutable = ["#Native",1,function(v){return !v}];

	if( fnName === "fn#<" )
	{
		SWYM.AddModifiedFunctionDeclaration("fn#>=", fnName, cscope, cscopeFunction, negateExecutable);
		SWYM.AddSwappedFunctionDeclaration("fn#>", fnName, cscope, cscopeFunction, undefined);
		SWYM.AddSwappedFunctionDeclaration("fn#<=", fnName, cscope, cscopeFunction, negateExecutable);
	}
	else if( fnName === "fn#>" )
	{
		SWYM.AddModifiedFunctionDeclaration("fn#<=", fnName, cscope, cscopeFunction, negateExecutable);
		SWYM.AddSwappedFunctionDeclaration("fn#<", fnName, cscope, cscopeFunction, undefined);
		SWYM.AddSwappedFunctionDeclaration("fn#>=", fnName, cscope, cscopeFunction, negateExecutable);
	}
	else if( fnName === "fn#<=" )
	{
		SWYM.AddModifiedFunctionDeclaration("fn#>", fnName, cscope, cscopeFunction, negateExecutable);
		SWYM.AddSwappedFunctionDeclaration("fn#>=", fnName, cscope, cscopeFunction, undefined);
		SWYM.AddSwappedFunctionDeclaration("fn#<", fnName, cscope, cscopeFunction, negateExecutable);
	}
	else if( fnName === "fn#>=" )
	{
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

SWYM.GetTypeFromExpression = function(node, cscope)
{
	var outType;
	var debugName;
	
	if( node.type === "name" )
	{		
		debugName = node.text;
		outType = cscope[node.text];
	}
	else if( node.type === "fnnode" )
	{
		var executable = [];
		outType = SWYM.CompileFunctionCall(node, cscope, executable);
		debugName = node.name + "()";
	}
	else
	{
		SWYM.LogError(node, "Invalid type expression: "+node);
		return;
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

SWYM.CompileFunctionBody = function(theFunction, cscope, executable)
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
				SWYM.LogError(0, "Fsckup: Failed to pass argument "+argName);
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
		returnType = bodyReturnType;
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

SWYM.NextArgTypeID = 501;

SWYM.CompileLambda = function(braceNode, argNode, cscope, executable)
{
	var debugName = SWYM.GetSource(braceNode.op.pos, braceNode.op.endSourcePos+1);
	if( argNode !== undefined )
	{
		if( argNode.op !== undefined && argNode.op.endSourcePos !== undefined )
		{
			debugName = SWYM.GetSource(argNode.op.pos, argNode.op.endSourcePos+1) + "->" + debugName;
		}
		else
		{
			debugName = argNode.text + "->" + debugName;
		}
	}
	else
	{
		debugName = "'it'->" + debugName;
	}

	var executableBlock = { type:"closure", debugName:debugName };

	executable.push("#Closure");
	executable.push(executableBlock);

	var closureType = {type:"type",
		needsCompiling:
		[{
			bodyNode:braceNode.children[1],
			argNode:argNode,
			cscope:cscope,
			executableBlock:executableBlock
		}]
	};
	
	// TODO: if the argtype is declared explicitly, we could do the compile now
	if( braceNode.children[1] === undefined )
	{
		SWYM.GetOutType(closureType, SWYM.AnyType);
	}
	
	return closureType;
}

SWYM.CompileLambdaInternal = function(compileBlock, argType)
{
	var node = compileBlock.bodyNode;
	var argNode = compileBlock.argNode;
	var cscope = compileBlock.cscope;
	var executableBlock = compileBlock.executableBlock;
	
	var innerCScope = object(cscope);
	var bodyExecutable = [];

	var argTypeID = SWYM.NextArgTypeID;
	SWYM.NextArgTypeID++;

//	var argType = {type:"value", canConstrain:true, template:["@ArgType", argTypeID]};  //FIXME: handle arg type declarations
	var argName;

	if( !argNode )
	{
		argName = "it";
		innerCScope["__default"] = {redirect:"it"};
	}
	else if( argNode.type === "decl" )
	{
		argName = argNode.value;
		innerCScope["__default"] = undefined;
		innerCScope["it"] = undefined;
	}
	else if ( argNode.op !== undefined && (argNode.op.text === "[" || argNode.op.text === "{") )
	{
		// destructuring an array/table arg
		argName = "~arglist~";
		bodyExecutable.push("#Load");
		bodyExecutable.push("~arglist~");

		SWYM.CompileDeconstructor(argNode, cscope, bodyExecutable, argType);

		bodyExecutable.push("#Pop");
		
		//argType = {type:"swymObject", ofClass:SWYM.ArrayClass, outType:{type:"value", canConstrain:true}};
	}
	else
	{
		SWYM.LogError(argNode, "Don't understand argument name "+argNode);
		return {type:"novalues"};
	}
	
	innerCScope[argName] = argType;

	var returnType = SWYM.CompileNode(node, innerCScope, bodyExecutable);
	
	executableBlock.argName = argName;
	executableBlock.body = bodyExecutable;

	//TODO: Blocks will probably want more members, such as "parseTree".
	return {type:"type", argType:argType, outType:returnType, baked:executableBlock};

//	argType.canConstrain = false;

//	var finalArgType = SWYM.selectiveClone(argType, ["type", "elementType", "argType", "argTypeID", "returnType", "classID", "classIDs"]);

	// FIXME: for now, all closures return a multivalue. (Horrible.)
//	if( !returnType || !returnType.multivalue )
//	{
//		bodyExecutable.push("#SingletonArray");
//		returnType = SWYM.ToMultivalueType(returnType);
//	}

	// FIXME: be smart about what variables are closed over, instead of grabbing the whole scope. (not just a nice-to-have: prevents memory leaks!)

//	var debugText = ""+node;
//	executable.push("#Closure");
//	executable.push({debugName:debugText, argName:argName, body:bodyExecutable});
	
//	return SWYM.ToClosureType(finalArgType, argTypeID, returnType);
}

SWYM.CompileClosureCall = function(argType, argExecutable, closureType, closureExecutable, cscope, executable)
{
	var numArgReferences = 0;
	var numClosureReferences = 0;
	var cannotInline = false;

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
			else if( closureBody[Idx] === "#Store" || closureBody[Idx] === "#Closure" ||
				closureBody[Idx] === "#Etc"|| closureBody[Idx] === "#EtcSequence" ||
				closureBody[Idx] === "#Return" || closureBody[Idx] === "#IfElse" )
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
		SWYM.pushEach(argExecutable, executable);
		SWYM.pushEach(closureExecutable, executable);
		executable.push("#ClosureCall");
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
}

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
		SWYM.CompileArrayDeconstructor(templateNode.children[1], 0, cscope, executable, argType);
	}
	else if( templateNode.op && templateNode.op.text === "{" )
	{
		SWYM.CompileTableDeconstructor(templateNode.children[1], cscope, executable, argType);
	}
	else
	{
		SWYM.LogError(templateNode, "Unexpected structure in argument declaration")
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
		SWYM.CompileDeconstructor(templateNode, cscope, executable, SWYM.GetOutType(argType));
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
	else if( templateNode.op && templateNode.op.text === "=>" )
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
	if( keyNode && keyNode.op && keyNode.op.text === "=>" )
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
	else if( node && node.op && node.op.text === "=>" )
	{
		SWYM.AddKeyAndValue(node.children[0], node.children[1], keyNodes, valueNodes);
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

SWYM.AddClassMember = function(typeNode, bodyNode,  typeNodes, nameNodes, defaultValueNodes)
{
	typeNodes.push(typeNode);
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

SWYM.CollectClassMembers = function(node, typeNodes, nameNodes, defaultValueNodes)
{
	if( node && node.op && (node.op.text === "," || node.op.text === ";" || node.op.text === "(blank_line)") )
	{
		SWYM.CollectClassMembers(node.children[0], typeNodes, nameNodes, defaultValueNodes);
		SWYM.CollectClassMembers(node.children[1], typeNodes, nameNodes, defaultValueNodes);
	}
	else if( node && (node.type === "decl" || (node.op && node.op.text === "=")) )
	{
		SWYM.AddClassMember(undefined, node,  typeNodes, nameNodes, defaultValueNodes);
	}
	else if( node && node.op && node.op.text === ":" )
	{
		SWYM.AddClassMember(node.children[0], node.children[1],  typeNodes, nameNodes, defaultValueNodes);
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
	var commonKeyType = SWYM.NoValuesType;
	var commonValueType = SWYM.NoValuesType;
	var elseExecutable = undefined;
	var elseValue = undefined;
	
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

		var valueType = SWYM.CompileNode(valueNodes[idx], cscope, elementExecutable);
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
		
		var keyType = SWYM.CompileNode(keyNodes[idx], cscope, []);
		commonKeyType = SWYM.TypeUnify(commonKeyType, keyType);

		if( keyType === undefined || keyType.baked === undefined )
		{
			SWYM.LogError(keyNodes[idx], "Table keys must be compile-time constants (at the moment).");
		}
		else
		{
			bakedKeys[idx] = keyType.baked;
		}
		
		if( valueType && valueType.multivalueOf !== undefined )
			SWYM.LogError(valueNodes[idx], "Error: json-style object declarations may not contain multi-values.");
	}

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
						SWYM.LogError(0, "Invalid table lookup. No key equals "+SWYM.ToDebugString(key));
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
						SWYM.LogError(0, "Invalid table lookup. No key equals "+SWYM.ToDebugString(key));
				},
				keys:bakedKeys,
				jsTable:table,
				elseValue:els
			}
		};
	}
	else
	{
		bakedKeys = SWYM.jsArray(bakedKeys);
		var constructor = function(values, els)
		{
			return {type:"table",
				run:function(key)
				{
					// not very happy with this. Use some kind of hash?
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
						SWYM.LogError(0, "Invalid table lookup. No key equals "+SWYM.ToDebugString(key));
				},
				keys:bakedKeys,
				values:values,
				elseValue:els
			}
		};
	}
	
	if ( bakedValues && (elseType === undefined || elseType.baked !== undefined) )
	{
		var bakedTable = constructor(SWYM.jsArray(bakedValues), elseValue);

		executable.push("#Literal");
		executable.push(bakedTable);
		
		var resultType = SWYM.TableTypeFromTo(commonKeyType, commonValueType, accessors);
		resultType.baked = bakedTable;
	}
	else if ( elseExecutable )
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
		
		var resultType = SWYM.TableTypeFromTo(commonKeyType, commonValueType, accessors);
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
		
	return resultType;
}


SWYM.CompileClassBody = function(node, cscope, defaultValueTable)
{
	var typeNodes = [];
	var nameNodes = [];
	var defaultValueNodes = [];
	
	SWYM.CollectClassMembers(node, typeNodes, nameNodes, defaultValueNodes);

	if( typeNodes.length !== nameNodes.length || nameNodes.length !== defaultValueNodes.length )
	{
		SWYM.LogError(node, "Fsckup: inconsistent numbers of types, names and values in struct!?");
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
			
			if( typeNodes[idx] === undefined )
			{
				memberTypes[memberName] = SWYM.AnyType;
			}
			else
			{
				var typeType = SWYM.CompileNode(typeNodes[idx], cscope, unusedExecutable);

				if( !typeType || !typeType.baked || typeType.baked.type !== "type" )
				{
					SWYM.LogError(typeNodes, "Type declaration for "+memberName+" is not a valid type!");
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
	var etcExecutable = [];
	var stepExecutable = undefined;
	if( parsetree.body.etcExpandAround !== undefined )
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
	else
	{
		var bodyType = SWYM.CompileNode(parsetree.body, cscope, etcExecutable);
	}
	
	if( parsetree.op.type === "fnnode" )
	{
		// kinda fugly - if we're dealing with a function call, then parsetree.op is actually a node.
		// we need to set the argument "this" to <etcSoFar>, representing the output from the etc
		// expression we've processed so far, and set the anonymous argument to be the body node.
		var etcScope = object(cscope);
		etcScope["<etcSoFar>"] = SWYM.NumberType; // FIXME

		parsetree.op.children[0] = SWYM.NewToken("name", parsetree.pos, "<etcSoFar>");
		parsetree.op.children[1] = parsetree.body;

		var etcExecutable = [];
		var returnType = SWYM.CompileFunctionCall(parsetree.op, etcScope, etcExecutable);
		etcExecutable.push("#Overwrite");
		etcExecutable.push("<etcSoFar>");

		executable.push("#Literal");
		executable.push(parsetree.op.identity);
		executable.push("#Store");
		executable.push("<etcSoFar>");
		executable.push("#EtcSimple");
		executable.push(["#Literal", 1000]); //TODO: handle limits properly
		executable.push(etcExecutable);
		executable.push("#Load");
		executable.push("<etcSoFar>");
		
		return returnType;
	}
	else
	{
		var initialValue = parsetree.op.behaviour.identity;
		var composer = parsetree.op.behaviour.infix;	
	}
	var postProcessor = function(v){return v;}; // null postprocessor
	var returnType = parsetree.op.behaviour.returnType;
	
	if( returnType === undefined && parsetree.op.behaviour.getReturnType )
	{
		returnType = parsetree.op.behaviour.getReturnType(bodyType, bodyType);
	}

	// problem operators we'll need to worry about: , && || + and of course .
	switch(parsetree.op.text)
	{
		case ",":
			postProcessor = function(list){ return SWYM.jsArray(list); };
			returnType = SWYM.ToMultivalueType(bodyType);
			
			if( bodyType && bodyType.multivalueOf !== undefined )
				composer = function(list, v){ SWYM.ConcatInPlace( list, v ); return list; };
			else
				composer = function(list, v){list.push(v); return list;};
			break;

		case "&&":
			SWYM.TypeCoerce(SWYM.BoolType, bodyType, parsetree, "&&etc arguments");
			if( bodyType && bodyType.multivalueOf !== undefined )
				composer = function(tru, v){ var result = SWYM.ResolveBool_Every(v); if(!result){ SWYM.g_etcState.halt = true; }; return result; };
			else
				composer = function(tru, v){ if(!v){ SWYM.g_etcState.halt = true; }; return v; };
			break;

		case "||":
			SWYM.TypeCoerce(SWYM.BoolType, bodyType, parsetree, "||etc arguments");
			if( bodyType && bodyType.multivalueOf !== undefined )
				composer = function(fals, v){ var result = SWYM.ResolveBool_Some(v); if(result){ SWYM.g_etcState.halt = true; }; return result; };
			else
				composer = function(fals, result){ if(result){ SWYM.g_etcState.halt = true; }; return result; };
			break;
	}
	
	if( parsetree.op.etc === "etc**" )
	{
		var limitTimes = [];
		var limitType = SWYM.CompileNode(parsetree.rhs, cscope, limitTimes);
		SWYM.TypeCoerce(SWYM.IntType, limitType, parsetree, "etc** number of times");
	}
	else
	{
		// Hack: to prevent infinite loops, etc is not allowed to repeat more than 1000 times.
		var limitTimes = ["#Literal", 1000];
	}
	
/*	if( parsetree.op.etc === "etc..<" )
	{
		shouldHalt = function(
	}

	if( haltCondition )
	{
		var baseComposer = composer;
		if( haltAfter )
		{
			composer = function(base, next){ if( shouldHalt(next) ){ SWYM.g_etcState.halt = true }; return baseComposer(base, next); };
		}
		else
		{
			composer = function(base, next){ if( shouldHalt(next) ){ SWYM.g_etcState.halt = true; return base; } else { return baseComposer(base, next); } };
		}
	}*/
	
	executable.push("#Etc");
	executable.push(limitTimes);
	executable.push(etcExecutable);
	executable.push(stepExecutable);
	executable.push(initialValue); // initial value
	executable.push(composer);
	executable.push(postProcessor);
	return returnType;
}

SWYM.pushEach = function(from, into)
{
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
			customCompile:function(argTypes, cscope, executable)
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

SWYM.DeclareNew = function(newStruct, defaultNodes, declCScope)
{
	//TODO: fix default member values (at the moment they will cause runtime errors.)
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
				return {type:"struct", debugName:SWYM.TypeToString(newStruct), structType:newStruct, members:members};
			},
			getReturnType:function(argTypes)
			{
				var memberTypes = {};
				for( var Idx = 0; Idx < memberNames.length; ++Idx )
				{
					memberTypes[memberNames[Idx]] = argTypes[Idx+1];
				}
				
				return {type:"type", debugName:SWYM.TypeToString(argTypes[0]? argTypes[0].baked: ""), nativeType:"Struct", memberTypes:memberTypes};
			}
		};
	
	var nextIndex = 0;
	for( var memberName in newStruct.memberTypes )
	{
		functionData.expectedArgs[memberName] = {index:nextIndex+1, typeCheck:newStruct.memberTypes[memberName], defaultValueNode:defaultNodes[memberName]};
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