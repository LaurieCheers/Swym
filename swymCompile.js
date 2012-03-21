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

// The "base" node compiler, which gets called by CompileNode.
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
			SWYM.LogError(parsetree.pos, "Unexpected literal <"+parsetree.value+">.");
		}
	}
	else if ( parsetree.type === "name" )
	{
		var loadName = parsetree.text;
		var loadName = SWYM.CScopeRedirect(cscope, loadName);
		var scopeEntry = cscope[loadName];
		
		if( scopeEntry === undefined )
		{
			SWYM.LogError(parsetree.pos, "Unknown identifier \""+parsetree.text+"\".");
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
			type0 = SWYM.TypeCoerce(argTypes[0], type0, "operator '"+parsetree.op.text+"'");
			++numArgs;
		}

		var tempexecutable1 = [];
		if( parsetree.children[1] )
		{
			var type1 = SWYM.CompileNode( parsetree.children[1], cscope, tempexecutable1 );
			type1 = SWYM.TypeCoerce(argTypes[1], type1, "operator '"+parsetree.op.text+"'");
			++numArgs;
		}
		if( (type0 && type0.multivalueOf !== undefined) || (type1 && type1.multivalueOf !== undefined) )
		{
			SWYM.pushEach(tempexecutable0, executable);
			if( parsetree.children[0] && (!type0 || type0.multivalueOf === undefined) )
			{
				executable.push("#ToMultivalue");
			}

			SWYM.pushEach(tempexecutable1, executable);
			if( parsetree.children[1] && (!type1 || type1.multivalueOf === undefined) )
			{
				executable.push("#ToMultivalue");
			}

			executable.push("#MultiNative");
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
			if( typeof(opFunction) !== 'function' )
			{
				SWYM.LogError(parsetree.op.pos, "Illegal use of operator "+parsetree.op.text);
			}
			executable.push("#Native");
			executable.push(numArgs);
			executable.push(opFunction);
			if( parsetree.op.behaviour.returnType )
			{
				return parsetree.op.behaviour.returnType;
			}
			else if( parsetree.op.behaviour.getReturnType )
			{
				return parsetree.op.behaviour.getReturnType(type0, type1);
			}
			else
			{
				SWYM.LogError(0, "Fsckup: Undefined return type for operator "+parsetree.op.text);
				return {type:"value"};
			}
		}
	}
	else
	{
		SWYM.LogError(parsetree.pos, "Symbol \""+parsetree.text+"\" is illegal here.");
	}
}

SWYM.CompileNode = function(node, cscope, executable)
{
	var resultType = SWYM.CompileLValue(node, cscope, executable);
	
	while( resultType && resultType.nativeType === "Variable" )
	{
		executable.push("#VariableContents");
		resultType = resultType.contentType;
	}
	
	var testType = resultType;
	
	if( resultType && resultType.multivalueOf !== undefined )
		testType = resultType.multivalueOf;
	
	// We want to condense an array of StringChars into a String.
	// This slightly dodgy test checks for an array of StringChars.
	// NB: Semantically, both String and StringChar behave as arrays of StringChars. So exclude them explicitly.
	if( testType && testType !== SWYM.StringType && testType !== SWYM.StringCharType &&
		testType.baked === undefined && testType.outType &&	testType.outType === SWYM.StringCharType &&
		testType.memberTypes && testType.memberTypes.length )
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
	var numAnonymous = 0;
	var args = {};
	for( var Idx = 0; Idx < fnNode.argNames.length; ++Idx )
	{
		if( fnNode.argNames[Idx] === "__" )
		{
			args["__"+numAnonymous] = fnNode.children[Idx];
			++numAnonymous;
		}
		else
		{
			args[ fnNode.argNames[Idx] ] = fnNode.children[Idx];
		}
	}

	var isMulti = false;
	var inputArgTypes = {};
	var inputArgExecutables = {};
	
	for( var inputArgName in args )
	{
		var inputExecutable = [];
		var inputType = SWYM.CompileNode( args[inputArgName], cscope, inputExecutable );
		
		if( inputType && inputType.multivalueOf !== undefined )
		{
			isMulti = true;
		}

		inputArgTypes[inputArgName] = inputType;
		inputArgExecutables[inputArgName] = inputExecutable;
	}

	
	var fnName = fnNode.name;
	var fnScopeName = "fn#"+fnName;
	var overloads = cscope[fnScopeName];
	if( !overloads )
	{
		SWYM.LogError(0, "Unknown function "+fnName);
		return;
	}
	
	var validOverloads = [];
	var bestError = undefined;
	var bestErrorQuality = -1;
		
	for( var Idx = 0; Idx < overloads.length; ++Idx )
	{
		var overloadResult = SWYM.CompileFunctionOverload(fnName, args, cscope, overloads[Idx], isMulti, inputArgTypes, inputArgExecutables);
		
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
		SWYM.LogError(0, bestError);
		return;
	}
	else if( validOverloads.length > 1 )
	{
		SWYM.LogError(0, "Too many valid overloads for "+fnName+"! (we don't do dynamic dispatch yet.)");
		return;
	}
	else
	{
		SWYM.pushEach( validOverloads[0].executable, executable );
		return validOverloads[0].returnType;
	}	
}

// returns {error:<an error>, executable:<an executable>, returnType:<a return type>}
SWYM.CompileFunctionOverload = function(fnName, args, cscope, theFunction, isMulti, inputArgTypes, inputArgExecutables)
{
	var overloadResult = {theFunction:theFunction, error:undefined, executable:[], returnType:undefined, quality:0};

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
		
		if( args[expectedArgName] === undefined )
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
			if( expectedArgTypeCheck && inputArgTypes[inputArgName] && !inputArgTypes[inputArgName].template )
			{
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
			overloadResult.quality = 5; // terrible match
			return overloadResult;
		}
	}

	var finalArgTypes = [];
	var argIndices = [];
	var customArgExecutables = [];
	var numArgsPassed = 0;
	var argNamesPassed = [];
	var argTypesPassed = [];

	for( var Idx = 0; Idx < inputArgNameList.length; Idx++ )
	{
		var inputArgName = inputArgNameList[Idx];
		if( inputArgName === undefined )
		{
			// default parameter, presumably
			continue;
		}
		var expectedArgName = expectedArgNamesByIndex[Idx];
		var tempType = inputArgTypes[inputArgName];

		argIndices[Idx] = Idx;
		finalArgTypes[Idx] = tempType;
		
		argTypesPassed[numArgsPassed] = SWYM.ToSinglevalueType(tempType);
		argNamesPassed[numArgsPassed] = expectedArgName;
		++numArgsPassed;
		
		if( theFunction.customCompileWithoutArgs )
		{
			customArgExecutables[Idx] = inputArgExecutables[inputArgName];
		}
		else
		{
			SWYM.pushEach(inputArgExecutables[inputArgName], overloadResult.executable);
			SWYM.TypeCoerce(theFunction.expectedArgs[expectedArgName].typeCheck, tempType, "calling '"+fnName+"', argument "+expectedArgName);

			if( isMulti && (!tempType || tempType.multivalueOf === undefined))
			{
				overloadResult.executable.push("#ToMultivalue");
			}
		}
	}

	var resultType;
	if ( theFunction.customCompile || theFunction.nativeCode )
	{
		if( !isMulti && theFunction.customCompile )
		{
			resultType = theFunction.customCompile(finalArgTypes, cscope, overloadResult.executable, customArgExecutables);
		}
		else if( isMulti && theFunction.multiCustomCompile )
		{
			//NB: multiCustomCompile is a special compile mode that takes raw multivalues (and/or normal values) as input, and
			// generates multivalues as output. But for consistency with other compile modes,
			// its result_type_ is still expected to be a single value.
			resultType = theFunction.multiCustomCompile(finalArgTypes, cscope, overloadResult.executable, customArgExecutables);
		}
		else if( isMulti && theFunction.customCompile && !theFunction.multiCustomCompile )
		{
			//var singularTypes = SWYM.Each(finalArgTypes, SWYM.ToSinglevalueType);
			resultType = theFunction.customCompile(finalArgTypes, cscope, overloadResult.executable, customArgExecutables);
		}
		
		if( theFunction.nativeCode )
		{
			if( isMulti )
			{
				overloadResult.executable.push("#MultiNative");
				overloadResult.executable.push(numArgsPassed);
				overloadResult.executable.push(theFunction.nativeCode);
			}
			else
			{
				overloadResult.executable.push("#Native");
				overloadResult.executable.push(numArgsPassed);
				overloadResult.executable.push(theFunction.nativeCode);
			}
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
			var bodyCScope = SWYM.MakeTable(SWYM.MainCScope, argNamesPassed, argTypesPassed);
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
	
		if( isMulti )
		{
			overloadResult.executable.push("#MultiFnCall");
			overloadResult.executable.push(fnName);
			overloadResult.executable.push(argNamesPassed);
			overloadResult.executable.push(precompiled.executable);
		}
		else
		{
			overloadResult.executable.push("#FnCall");
			overloadResult.executable.push(fnName);
			overloadResult.executable.push(argNamesPassed);
			overloadResult.executable.push(precompiled.executable);
		}
	}
	
	if( resultType === undefined )
	{
		if( theFunction.returnType !== undefined )
		{
			resultType = theFunction.returnType;
		}
		else
		{
			resultType = SWYM.GetFunctionReturnType(finalArgTypes, argIndices, theFunction);
		}
	}
	
	if( isMulti )
	{
		if(resultType && resultType.multivalueOf !== undefined)
		{
			overloadResult.executable.push("#Flatten");
			overloadResult.returnType = resultType;
		}
		else
		{
			overloadResult.returnType = SWYM.ToMultivalueType(resultType);
		}
	}
	else
	{
		overloadResult.returnType = resultType;
	}
	
	return overloadResult;
}

SWYM.GetPrecompiled = function(theFunction, argTypes)
{
	if( !theFunction.precompiled )
	{
		theFunction.precompiled = [];
	}

	var mustCompile = false;
	for( var AIdx = 0; AIdx < argTypes.length; ++AIdx )
	{
		if( argTypes[AIdx] && argTypes[AIdx].needsCompiling )
		{
			mustCompile = true;
			break;
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
					if( !SWYM.TypeMatches(cur.types[AIdx], argTypes[AIdx]) ||
						!SWYM.TypeMatches(argTypes[AIdx], cur.types[AIdx]) )
					{
						matched = false;
						break;
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
			argNode = argNode.children[1];
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
				SWYM.LogError(argNode.pos, "Invalid type expression");
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
		toString: function(){ return str; },
		returnType: {type:"incomplete"}
	};

	SWYM.AddFunctionDeclaration(fnName, cscope, cscopeFunction);
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
		var temp = cscope[fnName];
		cscope[fnName] = [];
		cscope[fnName].more = temp;
	}

	cscope[fnName].push( cscopeFunction );
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
		SWYM.LogError(node.pos, "Invalid type expression: "+node);
		return;
	}

	if( outType === undefined )
	{
		SWYM.LogError(node.pos, "Unknown type name "+debugName);
		return;
	}
	else if ( outType.baked === undefined || outType.baked.type !== "type" )
	{
		SWYM.LogError(node.pos, "Name "+debugName+" does not describe a type.");
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
			
			var argNameList = [];
			SWYM.GetDeconstructorNameList( deconstructNode.children[1], argNameList );
			SWYM.CompileDeconstructor(argNameList, bodyExecutable, cscope, cscope[argName] );
			
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
					SWYM.TypeCoerce(theArg.typeCheck, defaultValueType, "default value for parameter '"+argName+"'");
				}
			}
			else
			{
				SWYM.LogError(0, "Fsckup: Failed to pass argument "+argName);
			}
		}
	}
	
	var bodyReturnType = SWYM.CompileNode(theFunction.bodyNode, cscope, bodyExecutable);
	
	if( theCurrentFunction.returnsValue && theCurrentFunction.returnsNoValue )
	{
		SWYM.LogError(0, "Not all returns from "+fnName+" return a value");
	}
	else if( theCurrentFunction.returnsValue && theCurrentFunction.yields )
	{
		SWYM.LogError(0, "Function "+fnName+" cannot both yield and return values");
	}

	if( theCurrentFunction.yields )
	{
		SWYM.pushEach(["#Literal", SWYM.jsArray([]), "#Store", "Yielded", "#Pop"], executable);
		
		if( theCurrentFunction.returnsNoValue )
			SWYM.pushEach(["#ReceiveReturnNoValue", bodyExecutable], executable);
		else
			SWYM.pushEach(bodyExecutable, executable);

		SWYM.pushEach(["#ClearStack", "#Load", "Yielded"], executable);
		// yield keyword will set the return type 
		return theCurrentFunction.returnType;
	}
	else if( theCurrentFunction.returnsValue )
	{
		SWYM.pushEach(["#ReceiveReturnValue", bodyExecutable], executable);
		// return keyword will set the return type
		return theCurrentFunction.returnType;
	}
	else if( theCurrentFunction.returnsNoValue )
	{
		SWYM.pushEach(["#ReceiveReturnNoValue", bodyExecutable], executable);
		cscopeFunction.returnType = {type:"void"};
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
		return bodyReturnType;
	}
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
	var executableBlock = { debugName:debugName };

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

	if( !argNode )
	{
		var argName = "it";
		innerCScope["__default"] = {redirect:"it"};
	}
	else if( argNode.type === "decl" )
	{
		var argName = argNode.value;
		innerCScope["__default"] = undefined;
		innerCScope["it"] = undefined;
	}
	else if ( argNode.type === "node" && argNode.op.text === "[" )
	{
		var argName = "~arglist~";
		bodyExecutable.push("#Load");
		bodyExecutable.push("~arglist~");

		var argNameList = [];
		SWYM.GetDeconstructorNameList( argNode.children[1], argNameList );
		SWYM.CompileDeconstructor(argNameList, bodyExecutable, cscope, argType);

		bodyExecutable.push("#Pop");
		
		//argType = {type:"swymObject", ofClass:SWYM.ArrayClass, outType:{type:"value", canConstrain:true}};
	}
	else
	{
		SWYM.LogError(argNode.pos, "Don't understand argument name "+argNode);
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
//		bodyExecutable.push("#ToMultivalue");
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
			else if( closureBody[Idx] === "#Store" || closureBody[Idx] === "#Closure" || closureBody[Idx] === "#Etc"|| closureBody[Idx] === "#EtcSequence" || closureBody[Idx] === "#Return" )
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

SWYM.GetDeconstructorNameList = function(templateNode, elementList, cscope)
{
	if( templateNode.type === "decl" )
	{
		elementList.push(templateNode);
	}
	else if( templateNode.op && templateNode.op.text === "[" )
	{
		var subElementList = [];
		SWYM.GetDeconstructorNameList(templateNode.children[1], subElementList);
		elementList.push(subElementList);
	}
	else if( templateNode.op && templateNode.op.text === "," )
	{
		SWYM.GetDeconstructorNameList(templateNode.children[0], elementList);
		SWYM.GetDeconstructorNameList(templateNode.children[1], elementList);
	}
	else
	{
		SWYM.LogError(templateNode.sourcePos, "Unexpected structure in list declaration")
	}
}

// Compile deconstructing expressions such as ['x','y']->{ x+y }
SWYM.CompileDeconstructor = function(argNameList, executable, cscope, argType)
{
	for( var Idx = 0; Idx < argNameList.length; ++Idx )
	{
		var entry = argNameList[Idx];
		
		if( entry )
		{
			executable.push("#Dup");
			executable.push("#Literal");
			executable.push(Idx);
			executable.push("#At");

			if( entry && entry.type === "decl" )
			{
				executable.push("#Store");
				executable.push(entry.value);
				
				cscope[entry.value] = SWYM.GetOutType(argType);
			}
			else if ( entry && entry.length > 0 )
			{
				SWYM.CompileDeconstructor(entry, executable, cscope, SWYM.GetOutType(argType));
			}

			executable.push("#Pop");
		}
	}
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
	else if( node )
	{
		SWYM.LogError(node.pos, "Error: each element of a table must be a 'key:value' declaration.");
	}
}

SWYM.CompileTable = function(node, cscope, executable)
{
	var keyNodes = [];
	var valueNodes = [];
	
	SWYM.CollectKeysAndValues(node, keyNodes, valueNodes);

	if( keyNodes.length != valueNodes.length )
	{
		SWYM.LogError(node.pos, "Fsckup: inconsistent numbers of keys and values in table!?");
	}
	
	var elementExecutable = [];
	var bakedKeys = [];
	var bakedValues = [];
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
				SWYM.LogError(keyNodes[idx].pos, "Table has too many 'else' clauses.");
			}
		}


		var keyType = SWYM.CompileNode(keyNodes[idx], cscope, []);
		commonKeyType = SWYM.TypeUnify(commonKeyType, keyType);

		if( keyType === undefined || keyType.baked === undefined )
		{
			SWYM.LogError(keyNodes[idx].pos, "Table keys must be compile-time constants (at the moment).");
		}
		else
		{
			bakedKeys[idx] = keyType.baked;
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

		if( valueType && valueType.multivalueOf !== undefined )
			SWYM.LogError(0, "Error: json-style object declarations may not contain multi-values.");
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
					// not very happy with this. Can't we do better?
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
		
		var resultType = SWYM.TableTypeFromTo(commonKeyType, commonValueType);
		resultType.baked = bakedTable;
		return resultType;
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
		
		return SWYM.TableTypeFromTo(commonKeyType, commonValueType);
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
		
		return SWYM.TableTypeFromTo(commonKeyType, commonValueType);
	}
}


SWYM.CompileClassBody = function(node, cscope, defaultNodes)
{
	var keyNodes = [];
	var valueNodes = [];
	
	SWYM.CollectKeysAndValues(node, keyNodes, valueNodes);

	if( keyNodes.length != valueNodes.length )
	{
		SWYM.LogError(node.pos, "Fsckup: inconsistent numbers of keys and values in table!?");
	}
	
	var memberTypes = {};
	var unusedExecutable = [];
	
	for( var idx = 0; idx < keyNodes.length; ++idx )
	{		
		if( !keyNodes[idx] || keyNodes[idx].type !== "decl" )
		{
			SWYM.LogError(node.pos, "Invalid member declaration "+keyNodes[idx]);
		}
		
		if( valueNodes[idx] && valueNodes[idx].op && valueNodes[idx].op.text === "=" )
		{
			defaultNodes[keyNodes[idx].value] = valueNodes[idx].children[1];
			valueNodes[idx] = valueNodes[idx].children[0];
		}

		var valueType = SWYM.CompileNode(valueNodes[idx], cscope, unusedExecutable);
		
		if( !valueType || !valueType.baked || valueType.baked.type !== "type" )
		{
			SWYM.LogError(node.pos, "Invalid member declaration "+keyNodes[idx]);
		}
		else
		{
			memberTypes[keyNodes[idx].value] = valueType.baked;
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
		var initialValue = parsetree.op.identity;
		var composerExecutable = [];
		SWYM.CompileFunctionCall(parsetree.op, cscope, composerExecutable);
		// TODO: now what?
		var composer = parsetree.op.behaviour.infix;
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
			if( bodyType && bodyType.multivalueOf !== undefined )
				composer = function(tru, v){ var result = SWYM.ResolveBool_Every(v); if(!result){ SWYM.g_etcState.halt = true; }; return result; };
			else
				composer = function(tru, v){ if(!v){ SWYM.g_etcState.halt = true; }; return v; };
			break;

		case "||":
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
		if( !SWYM.TypeMatches( {type:"Number"}, limitType ) )
			SWYM.LogError(0, "Error - etc** expects a number for number of times to repeat; got "+limitType? limitType.type: limitType);
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
				
				if( argTypes[0] && argTypes[0].memberTypes && argTypes[0].memberTypes[memberName] )
				{
					return argTypes[0].memberTypes[memberName];
				}
				else
				{
					return memberType;
				}
			}
		});
}

SWYM.DeclareNew = function(newStruct, defaultNodes, declCScope)
{
	//TODO: fix default member values (at the moment they will cause runtime errors.)
	var memberNames = [];
	var functionData = {
			expectedArgs:{"this":{index:0, typeCheck:SWYM.BakedValue(newStruct)}},
			customCompileWithoutArgs:true,
			customCompile:function(argTypes, cscope, executable, argExecutables)
			{
				for( var Idx = 0; Idx < memberNames.length; ++Idx )
				{
					if( argTypes[Idx+1] !== undefined )
					{
						SWYM.pushEach(argExecutables[Idx+1], executable);
					}
					else
					{
						var defaultType = SWYM.CompileNode(defaultNodes[memberNames[Idx]], declCScope, executable);
						SWYM.TypeCoerce(newStruct.memberTypes[memberNames[Idx]], defaultType, "default value for member '"+memberNames[Idx]+"' of '"+newStruct.debugName+"'" );
					}
				}
				executable.push("#Native")
				executable.push(memberNames.length);
				executable.push(function()
				{
					var members = {};
					for( var Idx = 0; Idx < memberNames.length; ++Idx )
					{
						members[memberNames[Idx]] = arguments[Idx];
					}
					return {type:"struct", structType:newStruct, members:members};
				});
				
				var memberTypes = {};
				for( var Idx = 0; Idx < memberNames.length; ++Idx )
				{
					memberTypes[memberNames[Idx]] = argTypes[Idx+1];
				}
				
				return {type:"type", memberTypes:memberTypes};
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