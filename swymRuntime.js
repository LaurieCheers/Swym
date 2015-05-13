if( window.SWYM === undefined )
{
	SWYM = {};
}

SWYM.Exec = function(executable)
{
	SWYM.doFinalOutput = true;
	SWYM.MainRScope = object(SWYM.DefaultGlobalRScope);
	SWYM.g_etcState = {depth:0, halt:false};
	
	var result = SWYM.ExecWithScope("main", executable, SWYM.MainRScope, []);
}

SWYM.value_novalues = {type:"novalues"};

SWYM.ExecWithScope = function(inDebugName, executable, rscope, stack)
{
	var PC = 0;

	while( PC < executable.length && !SWYM.halt )
	{
		switch(executable[PC])
		{
		case "#RawNative":
			executable[PC+1](stack);
			PC += 2;
			break;

		case "#Literal":
			stack.push(executable[PC+1]);
			PC += 2;
			break;

		case "#SingletonArray":
			var original = stack.pop();
			if( original === SWYM.value_novalues )
			{
				stack.push( SWYM.jsArray([]) );
			}
			else
			{
				stack.push( SWYM.jsArray([original]) );
			}
			PC += 1;
			break;

		case "#CopyArray":
			var original = stack.pop();
			var newValue = SWYM.jsArray(SWYM.ConcatInPlace([], original));
			stack.push( newValue );
			PC += 1;
			break;
			
		case "#Native":
			var args = SWYM.CollectArgs(stack, executable[PC+1]);
			if( args.isNovalues )
				stack.push( SWYM.value_novalues );
			else
				stack.push( executable[PC+2].apply(undefined,args) );
			PC += 3;
			break;

		case "#NativeThis":
			var args = SWYM.CollectArgs(stack, executable[PC+1]);
			var thisArg = stack.pop();
			if( args.isNovalues )
				stack.push( SWYM.value_novalues );
			else
				stack.push( executable[PC+2].apply(thisArg,args) );
			PC += 3;
			break;
			
		case "#MultiNative":
			var multiArgs = SWYM.CollectArgs(stack, executable[PC+1]);
			var operatorBody = executable[PC+2];
			var result = SWYM.ForEachPairing(multiArgs, function(args)
			{
				return operatorBody.apply(undefined,args);
			});
			stack.push(result);
			PC += 3;
			break;
			
		case "#LazyNative":
			var multiArgs = SWYM.CollectArgs(stack, executable[PC+1]);
			var operatorBody = executable[PC+2];
			var result = SWYM.CrossLazyArrays(multiArgs, function(args)
			{
				return operatorBody.apply(undefined,args);
			});
			stack.push(result);
			PC += 3;
			break;
			
		case "#ArgStore":
			var varname = executable[PC+1];
			rscope[varname] = stack.pop();
			PC += 2;
			break;
					
		case "#Store":
			var varname = executable[PC+1];
			if( rscope[varname] !== undefined )
			{
				SWYM.LogError(-1, "Fsckup: Variable "+varname+" already defined");
				return;
			}
			var storingValue = stack.pop();
			rscope[varname] = storingValue;
			stack.push( storingValue );
			PC += 2;
			break;

		case "#Overwrite":
			var varname = executable[PC+1];
			var storingValue = stack.pop();

			if( rscope[varname] === undefined )
			{
				SWYM.LogError(-1, "Fsckup: Variable "+varname+" not defined");
				return;
			}
			var targetScope = rscope;
			while( !targetScope.hasOwnProperty(varname) )
				targetScope = targetScope.__proto__;

			targetScope[varname] = storingValue;
			stack.push( storingValue );
			PC += 2;
			break;
			
		case "#Load":
			var varname = executable[PC+1];
			if( rscope[varname] === undefined )
			{
				SWYM.LogError(-1, "Fsckup: Variable "+varname+" is undefined");
				return;
			}
			stack.push( rscope[varname] );
			PC += 2;
			break;
		
		case "#LoadFromClosure":
			var varname = executable[PC+1];
			var closure = stack.pop();
			if( !closure || !closure.scope )
			{
				SWYM.LogError(-1, "Fsckup: Trying to access "+varname+", but closure has no scope!?");
				return;
			}
			else if( closure.scope[varname] === undefined )
			{
				SWYM.LogError(-1, "Fsckup: Closure variable "+varname+" is undefined");
				return;
			}
			stack.push( closure.scope[varname] );
			PC += 2;
			break;

		case "#ClearStack":
			stack = [];
			PC += 1;
			break;
			
		case "#ForceSingleValue":
			stack.push( SWYM.ForceSingleValue(stack.pop()) );
			PC += 1;
			break;

		case "#BeginArgs":
			stack.push({});
			PC += 1;
			break;
		
		case "#AddArg":
			var argName = executable[PC+1];
			var argValue = stack.pop();
			stack[stack.length-1][argName] = argValue;
			PC += 2;
			break;

		case "#MultiFnCall":
			var debugName = executable[PC+1];
			var argNames = executable[PC+2];
			var body = executable[PC+3];
			
			var multiArgs = SWYM.CollectArgs(stack, argNames.length);
			var result = SWYM.ForEachPairing(multiArgs, function(args)
			{
				var callScope = SWYM.MakeTable(SWYM.MainRScope, argNames, args);
				return SWYM.ExecWithScope(debugName, body, callScope, []);
			});
			stack.push(result);
			PC += 4;
			break;
			
		case "#FnCall":
			var debugName = executable[PC+1];
			var argNames = executable[PC+2];
			var body = executable[PC+3];
			
			var args = SWYM.CollectArgs(stack, argNames.length);
			if( args.isNovalues )
			{
				stack.push(SWYM.value_novalues);
			}
			else
			{
				var callScope = SWYM.MakeTable(SWYM.MainRScope, argNames, args);
				stack.push( SWYM.ExecWithScope(debugName, body, callScope, []) );
			}
			PC += 4;
			break;
			
		case "#Closure":
			// This instruction has two different modes - if the closureInfo has an executable,
			// it will build it into a full-fledged runtime-callable closure.
			// If not it just builds a variable capture object; no runtime closure is needed.
			// (it's been inlined, because all call sites were unambiguous at compile time.)
			var closureInfo = executable[PC+1];
			var variableCapture = {
				type: "closure", // TODO: should be "variableCapture"
				debugName: closureInfo.debugName,
				scope: rscope // TODO: pick out the elements of rscope which the capture actually refers to
			}
			
			if( closureInfo.executable !== undefined )
			{
				stack.push( SWYM.NewClosure(closureInfo, variableCapture) );
			}
			else
			{
				stack.push(variableCapture);
			}
			PC += 2;
			break;
			
		case "#ClosureCall":
			var closure = stack.pop();
			var arg = stack.pop();
			
			stack.push( SWYM.ClosureCall(closure, arg) );
			PC += 1;
			break;
			
		case "#ClosureExec":
			var closure = stack.pop();
			var arg = stack.pop();

			stack.push( SWYM.ClosureExec(closure, arg, executable[PC+1]) );
			PC += 2;
			break;

		case "#MultiClosureCall":
			var multiArgs = SWYM.CollectArgs(stack, 2);
			var result = SWYM.ForEachPairing(multiArgs, function(args)
			{
				return SWYM.ClosureCall(args[1], args[0]);
			});
			stack.push( result );
			PC += 1;
			break;
			
		case "#MultiClosureExec":
			var multiArgs = SWYM.CollectArgs(stack, 2);
			var result = SWYM.ForEachPairing(multiArgs, function(args)
			{
				return SWYM.ClosureExec(args[1], args[0], executable[PC+1]);
			});
			stack.push( result );
			PC += 2;
			break;

		case "#LazyClosureCall":
			var multiArgs = SWYM.CollectArgs(stack, 2);
			var result = SWYM.CrossLazyArrays(multiArgs, function(args)
			{
				return SWYM.ClosureCall(args[1], args[0]);
			});
			stack.push( result );
			PC += 1;
			break;
			
		case "#Flatten":
			var list = stack.pop();
			stack.push( SWYM.Flatten(list) );
			PC += 1;
			break;

		case "#LazyFlatten":
			var list = stack.pop();
			stack.push( SWYM.LazyFlatten(list) );
			PC += 1;
			break;
			
		case "#DoMultiple":
			var arrayPosition = executable[PC+1];
			var numPops = executable[PC+2];
			var numLevels = executable[PC+3];
			var quantifierExecutable = executable[PC+4];

			var newStack = [];
			newStack.length = numPops;
			for( var Idx = 0; Idx < numPops; ++Idx )
			{
				newStack[numPops - (Idx+1)] = stack.pop();
			}

			stack.push( SWYM.DoIteration( debugName, newStack[ arrayPosition ], 1, numLevels, newStack, arrayPosition, quantifierExecutable, rscope ) );
			PC += 5;
			break;
			
		case "#ORQuantifier":
			var array = stack.pop();
			var result = false;
			for( var Idx = 0; Idx < array.length; Idx++ )
			{
				if( array.run(Idx) === true )
				{
					result = true;
					break;
				}
			}
			stack.push(result);
			PC += 1;
			break;

		case "#NORQuantifier":
			var array = stack.pop();
			var result = true;
			for( var Idx = 0; Idx < array.length; Idx++ )
			{
				if( array.run(Idx) === true )
				{
					result = false;
					break;
				}
			}
			stack.push(result);
			PC += 1;
			break;

		case "#ANDQuantifier":
			var array = stack.pop();
			var result = true;
			for( var Idx = 0; Idx < array.length; Idx++ )
			{
				if( array.run(Idx) !== true )
				{
					result = false;
					break;
				}
			}
			stack.push(result);
			PC += 1;
			break;

		case "#NANDQuantifier":
			var array = stack.pop();
			var result = false;
			for( var Idx = 0; Idx < array.length; Idx++ )
			{
				if( array.run(Idx) !== true )
				{
					result = true;
					break;
				}
			}
			stack.push(result);
			PC += 1;
			break;

		case "#At":
			var index = stack.pop();
			var table = stack.pop();
			var element = table.run(index);
			if( element === undefined )
			{
				if( SWYM.g_etcState.depth > 0 )
				{
					SWYM.g_etcState.halt = true;
					SWYM.halt = true;
				}
				else
					SWYM.LogError(-1, "at: Index out of bounds - "+SWYM.ToDebugString(table)+".at("+SWYM.ToDebugString(index)+")");
			}
			else
			{
				stack.push(element);
			}
			PC += 1;
			break;

		case "#MultiAt":
			var multiArgs = SWYM.CollectArgs(stack, 2);
			var result = SWYM.ForEachPairing(multiArgs, function(args)
			{
				var element = args[0].run(args[1]);
				if( element === undefined )
				{
					if( SWYM.g_etcState.depth > 0 )
					{
						SWYM.g_etcState.halt = true;
						SWYM.halt = true;
					}
					else
						SWYM.LogError(-1, "at: Index out of bounds - "+SWYM.ToDebugString(table)+".at("+SWYM.ToDebugString(index)+")");
				}
				else
				{
					return(element);
				}
			});
			stack.push(result);
			PC += 1;
			break;
			
		case "#VariableContents":
			var variable = stack.pop();
			if( variable === undefined )
			{
				SWYM.LogError(-1, "Fsckup: undefined variable for #VariableContents instruction");
				stack.push( undefined );
			}
			else if ( variable.getter !== undefined )
				stack.push( variable.getter() );
			else
				stack.push( variable.value );
			PC += 1;
			break;
			
		case "#MultiVariableContents":
			var variables = stack.pop();
			var result = [];
			for( var Idx = 0; Idx < variables.length; Idx++ )
			{
				var v = variables[Idx];
				if( v === undefined )
				{
					SWYM.LogError(-1, "Fsckup: undefined variable for #MultiVariableContents instruction");
					stack.push( undefined );
				}
				else if( v.getter !== undefined )
					result.push( v.getter() );
				else
					result.push( v.value );
			}
			stack.push(SWYM.jsArray(result));
			PC += 1;
			break;

		case "#VariableAssign":
			var newValue = stack.pop();
			var variable = stack.pop();
			if( variable.setter !== undefined )
				variable.setter(newValue);
			else
				variable.value = newValue;
			stack.push(variable);
			PC += 1;
			break;
			
		case "#MultiVariableAssign":
			var newValue = stack.pop();
			var variables = stack.pop();
			for( var Idx = 0; Idx < variables.length; Idx++ )
			{
				var v = variables[Idx];
				
				if( v.setter !== undefined )
					v.setter(newValue);
				else
					v.value = newValue;
			}
			stack.push(variables);
			PC += 1;
			break;

		case "#ArrayToClosure":
			var arr = stack.pop();
			stack.push( SWYM.ArrayToClosure(arr) );
			PC += 1;
			break;

		case "#ValueToClosure":
			var val = stack.pop();
			stack.push( SWYM.ValueToClosure(val) );
			PC += 1;
			break;
			
		case "#ConcatArrays":
			var args = SWYM.CollectArgs(stack, executable[PC+1]);
			stack.push( SWYM.ConcatAll(args) )
			PC += 2;
			break;

		case "#CreateArray":
			var args = SWYM.CollectArgs(stack, executable[PC+1]);
			stack.push( SWYM.jsArray(args) );
			PC += 2;
			break;

		case "#ToTerseString":
			stack.push(SWYM.StringWrapper( SWYM.ToTerseString(stack.pop()) ));
			PC += 1;
			break;

		case "#ToMultiDebugString":
			stack.push(SWYM.StringWrapper( SWYM.ToMultiDebugString(stack.pop()) ));
			PC += 1;
			break;

		case "#ToDebugString":
			stack.push(SWYM.StringWrapper( SWYM.ToDebugString(stack.pop()) ));
			PC += 1;
			break;

		case "#DefineFunction":
			stack.push({executable:executable[PC+1], scope:rscope});
			PC += 2;
			break;

		case "#Swap":
			var a = stack.pop();
			var b = stack.pop();
			stack.push(a);
			stack.push(b);
			PC += 1;
			break;
			
		case "#Swap3":
			var a = stack.pop();
			var b = stack.pop();
			var c = stack.pop();
			stack.push(a);
			stack.push(b);
			stack.push(c);
			PC += 1;
			break;
			
		case "#Dup":
			stack.push( stack[stack.length-1] );
			PC += 1;
			break;

		case "#Add":
			stack.push( stack.pop() + stack.pop() );
			PC += 1;
			break;

		case "#Sub":
			var b = stack.pop();
			stack.push( stack.pop() - b );
			PC += 1;
			break;

		case "#Mul":
			stack.push( stack.pop() * stack.pop() );
			PC += 1;
			break;

		case "#Div":
			var b = stack.pop();
			stack.push( stack.pop() / b );
			PC += 1;
			break;

		case "#Mod":
			var b = stack.pop();
			stack.push( stack.pop() % b );
			PC += 1;
			break;

		case "#AddEach":
			var rhs = stack.pop();
			var lhs = stack.pop();
			var result = [];
			for( var Idx = 0; Idx < rhs.length; Idx++ )
			{
				result.push( lhs + rhs.run(Idx) );
			}
			stack.push(SWYM.jsArray(result));
			PC += 1;
			break;

		case "#Pop":
			stack.pop();
			PC += 1;
			break;

		case "#IfElse":
			if( stack.pop() )
				stack.push( SWYM.ExecWithScope("IfYes", executable[PC+1], rscope, []) );
			else
				stack.push( SWYM.ExecWithScope("IfNo", executable[PC+2], rscope, []) );
			PC += 3;
			break;

		case "#EtcExpansion":
			var etcStepExecutable = executable[PC+1];
			var index = stack.pop();
			if( index === undefined )
			{
				SWYM.LogError(-1, "Fsckup: missing etcIndex!");
			}
			var result = stack.pop();

			//NB: <= because we need one level of expansion on the first term
			for( var subIndex = 0; subIndex <= index; ++subIndex )
			{
				rscope["<etcExpansion>"] = subIndex;
				rscope["<etcExpansionCurrent>"] = result;
				result = SWYM.ExecWithScope("EtcStep", etcStepExecutable, rscope, []);
			}
			
			stack.push( result );

			PC += 2;
			break;
			
		case "#EtcSimple":
			var etcLimit = executable[PC+1];
			var etcStepExecutable = executable[PC+2];
			var etcHaltExecutable = executable[PC+3];
			var etcHaltTest = executable[PC+4];

			var limit = etcLimit? SWYM.ExecWithScope("EtcLimit", etcLimit, rscope, []): 1000; //FIXME
			var haltValue = SWYM.ExecWithScope("EtcHaltValue", etcHaltExecutable, rscope, []);

			SWYM.g_etcState.depth++;
			SWYM.g_etcState.halt = false;

			for( var etcIndex = 0; etcIndex < limit; ++etcIndex )
			{
				rscope["<etcIndex>"] = etcIndex;
				
				var newValue = SWYM.ExecWithScope("EtcStep", etcStepExecutable, rscope, []);

				if( SWYM.g_etcState.halt )
					break;

				if( etcHaltTest && etcHaltTest(newValue, haltValue) )
					break;
					
				rscope["<etcSoFar>"] = newValue;
			}

			if( SWYM.g_etcState.halt && SWYM.halt && !SWYM.errors )
			{
				SWYM.halt = false;
			}

			SWYM.g_etcState.halt = false;
			SWYM.g_etcState.depth--;
			PC += 5;
			break;
		
		case "#Etc":
			var etcLimit = executable[PC+1];
			var etcBodyExecutable = executable[PC+2];
			var etcInitialExecutable = executable[PC+3];
			var etcComposer = executable[PC+4];
			var etcPostProcessor = executable[PC+5];
			var etcHaltExecutable = executable[PC+6];
			var etcHaltTest = executable[PC+7];

			var limitTimes = etcLimit? SWYM.ExecWithScope("EtcLimit", etcLimit, rscope, []): 1000; // FIXME
			var haltValue = SWYM.ExecWithScope("EtcHaltValue", etcHaltExecutable, rscope, []);

			var newRScope = object(rscope);
			newRScope["<etcIndex>"] = 0;
			var etcResult = SWYM.ExecWithScope("EtcInitial", etcInitialExecutable, rscope, []);
			
			SWYM.g_etcState.depth++;
			SWYM.g_etcState.halt = false;

			for( var etcIndex = 0; etcIndex < limitTimes; ++etcIndex )
			{
				newRScope["<etcIndex>"] = etcIndex;
				var nextResult = SWYM.ExecWithScope("EtcBody", etcBodyExecutable, newRScope, []);

				if( etcStepExecutable !== undefined )
				{
					newRScope["<prevEtc>"] = nextResult;
					etcBodyExecutable = etcStepExecutable;
				}
				
				if( SWYM.g_etcState.halt )
					break;
				
				if( etcHaltTest && etcHaltTest(nextResult, haltValue) )
					break;

				etcResult = etcComposer( etcResult, nextResult );

				if( SWYM.g_etcState.halt )
					break;
			}
			
			if( SWYM.g_etcState.halt && SWYM.halt && !SWYM.errors )
			{
				SWYM.halt = false;
			}

			SWYM.g_etcState.halt = false;
			SWYM.g_etcState.depth--;
			stack.push( etcPostProcessor(etcResult) );
			PC += 8;
			break;
			
		case "#EtcSequence":
			var etcGenerator = executable[PC+1];
			var index = rscope["<etcIndex>"];
			if( index === undefined )
			{
				SWYM.LogError(-1, "Fsckup: missing etcIndex!");
			}
			stack.push(etcGenerator(index));
			PC += 2;
			break;
			
		case "#Return":
			var returnData = rscope["<returned>"];
			if( !returnData )
			{
				SWYM.LogError(-1, "Fsckup: return value without any returnData!?");
			}
			else
			{
				returnData.value = stack.pop();
				returnData.halt = true;
				SWYM.halt = true;
			}
			PC += 1;
			break;

		case "#ReceiveReturnValue":
			var bodyExecutable = executable[PC+1];
			var returnScope = object(rscope);
			var returnData = {value:undefined, halt:false};
			returnScope["<returned>"] = returnData;
			SWYM.ExecWithScope("ReceiveReturn", bodyExecutable, returnScope, []);
			if( !SWYM.halt )
			{
				SWYM.LogError(-1, "Fsckup: Function failed to return at all!?");
			}
			else if( returnData.halt )
			{
				if( returnData.value === undefined )
				{
					SWYM.LogError(-1, "Fsckup: Function failed to return a value!?");
				}
				else
				{
					stack.push(returnData.value);
				}
				
				if( SWYM.halt && !SWYM.errors )
				{
					SWYM.halt = false;
				}
			}
			PC += 2;
			break;

		case "#ReceiveReturnNoValue":
			var bodyExecutable = executable[PC+1];
			var returnScope = object(rscope);
			var returnData = {halt:false};
			returnScope["<returned>"] = returnData;
			SWYM.ExecWithScope("ReceiveReturn", bodyExecutable, returnScope, []);
			
			if( SWYM.halt && returnData.halt && !SWYM.errors )
			{
				SWYM.halt = false;
			}
			PC += 2;
			break;
			
		default:
			//error!
			SWYM.LogError(-1, "Fsckup: SWYM.Exec can't understand opcode "+executable[PC]);
			return;
		}
	}
	
	if( SWYM.errors )
		return undefined;
	else if( stack !== [] )
		return stack.pop();
}

SWYM.NewClosure = function(closureInfo, variableCapture)
{
	var closureExecutable = closureInfo.executable;
	var result = {
		type:"closure",
		debugName:closureInfo.debugName,
		variableCapture:variableCapture,
		run:function(key) { return SWYM.ClosureExec(variableCapture, key, closureExecutable); }
	}
	return result;
}

SWYM.CollectArgs = function(stack, numArgs)
{
	if( stack.length < numArgs )
	{
		SWYM.LogError(-1, "Fsckup: should have "+numArgs+" items on the stack now, got only "+stack.length+"!");
		return [];
	}
	
	var args = [];
	args.length = numArgs;
	var isNovalues = false;
	// arguments will come off the stack in reverse order, so we build the args list backwards.
	while( numArgs > 0 )
	{
		numArgs--;
		var temp = stack.pop();
		args[numArgs] = temp;

		if( temp === SWYM.value_novalues )
			isNovalues = true;
	}

	args.isNovalues = isNovalues;
	return args;
}

SWYM.MakeTable = function(proto, names, values)
{
	var result = object(proto);
	for( var Idx = 0; Idx < names.length; Idx++ )
	{
		result[names[Idx]] = values[Idx];
	}
	return result;
}

SWYM.ForEachPairing = function(multiArgs, body)
{
	var result = [];
	if( multiArgs.length <= 0 )
	{
	}
	else if( multiArgs.length === 1 )
	{
		// optimization for the 1 arg case
		var multivalue = multiArgs[0];
		if( multivalue === undefined )
		{
			SWYM.LogError(0, "Fsckup: Undefined multivalue at runtime!");
		}
		else
		{
			for( var Idx = 0; Idx < multivalue.length && !SWYM.halt; Idx++ )
			{
				result.push( body([multivalue.run(Idx)]) );
			}
		}
	}
	else if( multiArgs.length === 2 )
	{
		// optimization for the 2 arg case
		var multivalueA = multiArgs[0];
		var multivalueB = multiArgs[1];
		if( multivalueA === undefined || multivalueB === undefined )
		{
			SWYM.LogError(0, "Fsckup: Undefined multivalue at runtime!");
		}
		else
		{
			for( var IdxA = 0; IdxA < multivalueA.length && !SWYM.halt; IdxA++ )
			{
				for( var IdxB = 0; IdxB < multivalueB.length && !SWYM.halt; IdxB++ )
				{
					result.push( body([multivalueA.run(IdxA), multivalueB.run(IdxB)]) );
				}
			}
		}
	}
	else if( multiArgs.length === 3 )
	{
		// optimization for the 3 arg case
		var multivalueA = multiArgs[0];
		var multivalueB = multiArgs[1];
		var multivalueC = multiArgs[2];
		if( multivalueA === undefined || multivalueB === undefined || multivalueC === undefined )
		{
			SWYM.LogError(0, "Fsckup: Undefined multivalue at runtime!");
		}
		else
		{
			for( var IdxA = 0; IdxA < multivalueA.length && !SWYM.halt; IdxA++ )
			{
				for( var IdxB = 0; IdxB < multivalueB.length && !SWYM.halt; IdxB++ )
				{
					for( var IdxC = 0; IdxC < multivalueC.length && !SWYM.halt; IdxC++ )
					{
						result.push( body([multivalueA.run(IdxA), multivalueB.run(IdxB), multivalueC.run(IdxC)]) );
					}
				}
			}
		}
	}
	else if( multiArgs.length === 4 )
	{
		// optimization for the 4 arg case
		var multivalueA = multiArgs[0];
		var multivalueB = multiArgs[1];
		var multivalueC = multiArgs[2];
		var multivalueD = multiArgs[3];
		if( multivalueA === undefined || multivalueB === undefined || multivalueC === undefined || multivalueD === undefined )
		{
			SWYM.LogError(0, "Fsckup: Undefined multivalue at runtime!");
		}
		else
		{
			for( var IdxA = 0; IdxA < multivalueA.length && !SWYM.halt; IdxA++ )
			{
				for( var IdxB = 0; IdxB < multivalueB.length && !SWYM.halt; IdxB++ )
				{
					for( var IdxC = 0; IdxC < multivalueC.length && !SWYM.halt; IdxC++ )
					{
						for( var IdxD = 0; IdxD < multivalueD.length && !SWYM.halt; IdxD++ )
						{
							result.push( body([multivalueA.run(IdxA), multivalueB.run(IdxB), multivalueC.run(IdxC), multivalueD.run(IdxD)]) );
						}
					}
				}
			}
		}
	}
	else
	{
		// the general (slowest) case: apply recursively
		var multivalue = multiArgs[0];
		for( var Idx = 0; Idx < multivalue.length && !SWYM.halt; Idx++ )
		{
			var value = multivalue.run(Idx);
			SWYM.ForEachPairing(multiArgs.slice(1), function(otherArgs)
			{
				var args = [value];
				SWYM.pushEach(otherArgs, args);
				result.push( body(args) );
			});
		}
	}
	return SWYM.jsArray(result);
}

SWYM.CrossLazyArrays = function(multiArgs, body)
{
	var len = 1;
	for( var Idx = 0; Idx < multiArgs.length; ++Idx )
	{
		len *= multiArgs[Idx].length;
	}
	
	return {
		type:"lazyArray",
		length: len,
		children:multiArgs,
		run:function(index)
		{
			var elements = [];
			SWYM.SelectCrossElements(this.children.length-1, index, this.children, elements);
			return body(elements);
		}
	};
}

SWYM.SelectCrossElements = function(start, index, multiArgs, elements)
{
	var len = multiArgs[start].length;
	
	elements.unshift( multiArgs[start].run(index%len) );
	
	if( start > 0 )
	{
		SWYM.SelectCrossElements(start-1, Math.floor(index/len), multiArgs, elements);
	}
}

SWYM.jsArray = function(array)
{
	array.type = "jsArray";
	array.run = function(index)
	{
		if( index >= 0 && index < this.length )
			return this[index];
		else
			SWYM.ReportOutOfBounds(this,index);
	};
	array.keys = SWYM.indexArray(array.length);
	return array;
}

SWYM.indexArrayBase = {
	type:"rangeArray",
	first:0,
	contains:function(value)
	{
		return value >= 0 && value < this.length && value%1==0;
	},
	run:function(index)
	{
		if( index >= 0 && index < this.length )
			return index;
		else
			SWYM.ReportOutOfBounds(this, index);
	}
};

SWYM.rangeArrayBase = {
	type:"rangeArray",
	contains:function(value)
	{
		return value >= this.first && value <= this.last && value%1==0;
	},
	run:function(index)
	{
		if( index >= 0 && index < this.length )
			return this.first+index;
		else
			SWYM.ReportOutOfBounds(this, index);
	}
};

SWYM.indexArray = function(length)
{
	var indexArray = object(SWYM.indexArrayBase);
	indexArray.length = length;
	indexArray.last = length-1;
	indexArray.keys = indexArray; // an index array is its own keys!
	return indexArray;
}

SWYM.rangeArray = function(first, last)
{
	if( last < first )
	{
		last = first-1; // length of the array can't be less than 0
	}
	
	if( first === 0 )
	{
		return SWYM.indexArray(last+1);
	}
	else
	{
		var rangeArray = object(SWYM.rangeArrayBase);
		rangeArray.length = 1+last-first;
		rangeArray.first = first;
		rangeArray.last = last;
		rangeArray.keys = SWYM.indexArray(1+last-first);
		return rangeArray;
	}
}

SWYM.StringWrapper = function(str, isChar)
{
	if( str === undefined )
	{
		return undefined;
	}
	else
	{
		return {
			type:"string",
			run: function(index)
			{
				if(index >= 0 && index < str.length)
					return SWYM.StringWrapper(this.data[index], true);
				else
					SWYM.ReportOutOfBounds(this, index);
			},
			length:str.length,
			keys:SWYM.indexArray(str.length),
			isChar: isChar?isChar:false,
			data:str
		};
	}
}

SWYM.CreateTable = function(keys, values)
{
	var jsTable = {};
	
	for( var Idx = 0; Idx < keys.length; ++Idx )
	{
		jsTable[ SWYM.ToDebugString(keys[Idx]) ] = values[Idx];
	}
	
	return {
		type:"table",
		run: function(key)
		{
			// ToDebugString is expensive - would be good to have a cheap alternative
			// e.g. if we knew that we were dealing with plain numbers or strings.
			return this.jsTable[ SWYM.ToDebugString(key) ];
		},
		keys:SWYM.jsArray(keys),
		jsTable:jsTable
	};
}

SWYM.ReportOutOfBounds = function(array, index)
{
  if( SWYM.g_etcState.depth > 0 )
  {
    SWYM.g_etcState.halt = true;
    SWYM.halt = true;
  }
  else
  {
    SWYM.LogError(-1, "Array index "+SWYM.ToDebugString(index)+" was out of bounds on array "+SWYM.ToDebugString(array));
  }
}

SWYM.ArrayContains = function(array, value)
{
	if( array.contains !== undefined )
	{
		return array.contains(value);
	}
	
	for( var Idx = 0; Idx < array.length; Idx++ )
	{
		if( SWYM.IsEqual( array.run(Idx), value ) )
			return true;
	}
	
	return false;
}

SWYM.StringContainsChar = function(str, c)
{
	if( str && str.type === "string" && c && c.type === "string" )
	{
		return str.data.indexOf(c.data) != -1;
	}
	
	return false;
}

SWYM.ConcatInPlace = function(target,source)
{
	// a normal array and a SWYM array
	for(var Idx = 0; Idx < source.length; ++Idx )
	{
		target.push( source.run(Idx) );
	}
	
	return target;
}

SWYM.Concat = function(a,b)
{
	// two SWYM arrays
	var result = [];
	SWYM.ConcatInPlace(result, a);
	SWYM.ConcatInPlace(result, b);
	
	return SWYM.jsArray(result);
}

SWYM.ConcatAll = function(arrays)
{
	// a normal list of SWYM arrays
	var result = [];
	for(var Idx = 0; Idx < arrays.length; ++Idx )
	{
		var subArray = arrays[Idx];
		for(var subIdx = 0; subIdx < subArray.length; ++subIdx )
		{
			result.push( subArray.run(subIdx) );
		}
	}
	
	return SWYM.jsArray(result);
}

SWYM.Flatten = function(array)
{
	// a SWYM list of SWYM arrays
	var result = [];
	if( !array )
	{
		SWYM.LogError(-1, "Fsckup: tried to Flatten '"+subArray+"'");
	}
	else
	{
		for(var Idx = 0; Idx < array.length; ++Idx )
		{
			var subArray = array.run(Idx);
			if( !subArray || subArray.length === undefined )
			{
				SWYM.LogError(-1, "Fsckup: SWYM.Flatten encountered invalid sub-array: "+subArray);
			}
			else
			{
				for(var subIdx = 0; subIdx < subArray.length; ++subIdx )
				{
					result.push( subArray.run(subIdx) );
				}
			}
		}
	}
	
	return SWYM.jsArray(result);
}

SWYM.LazyFlatten = function(arrayOfArrays)
{
	return {
		type:"lazyArray",
		cached:[],
		nextAIndex:0,
		nextBIndex:0,
		run:function(index)
		{
			while(this.cached.length <= index)
			{
				if( arrayOfArrays.length <= this.nextAIndex )
				{
					SWYM.ReportOutOfBounds(this, index);
					return;
				}
				
				var array = arrayOfArrays.run(this.nextAIndex);
								
				while(this.cached.length <= index)
				{
					if( array === undefined || array.length <= this.nextBIndex )
					{
						// exhausted this subarray
						this.nextAIndex += 1;
						this.nextBIndex = 0;
						break;
					}

					var v = array.run(this.nextBIndex);
					this.cached.push(v);
					this.nextBIndex += 1;
				}
			}

			return this.cached[index];
		}
	};	
}

SWYM.TableMatches = function(table, tablePattern)
{
	for( var MemberName in table )
	{
		// extraneous member
		if( !tablePattern[MemberName] )
			return false;
		
		var match = SWYM.ClosureCall( tablePattern[MemberName], table[MemberName] );
		
		// typecheck failed
		if( !match[0] )
			return false;
	}
	
	for( var MemberName in tablePattern )
	{
		// lacking a required member
		if( table[MemberName] === undefined )
			return false;
	}
	
	return true;
}

SWYM.ClosureExec = function(variableCapture, arg, executable)
{
	if( variableCapture === undefined )
	{
		SWYM.LogError(-1, "Fsckup: #ClosureExec with no variableCapture value");
		return;
	}
	else if ( variableCapture.run || variableCapture.type === "type" )
	{
		return SWYM.ClosureCall(variableCapture, arg);
	}
	
	if (variableCapture.variableCapture !== undefined)
	{
		variableCapture = variableCapture.variableCapture;
	}

	var callScope = object(variableCapture.scope)
	return SWYM.ExecWithScope(variableCapture.debugName, executable, callScope, [arg]);
}

SWYM.ClosureCall = function(closure, arg)
{
	if( !closure )
	{
		SWYM.LogError(-1, "Fsckup: missing closure body");
	}
	else if ( closure.run )
	{
		return closure.run(arg);
	}
	else if( closure.type === "type" )
	{
		return SWYM.IsOfType(arg, closure);
	}
	else
	{
		SWYM.LogError(-1, "'"+SWYM.ToDebugString(closure)+"' is not a callable object!");
	}
}

SWYM.RangeOp = function(start, end, includeStart, includeEnd, forceStep)
{
	if( forceStep !== undefined )
		var step = forceStep;
	else if ( start < end )
		var step = 1;
	else
		var step = -1;
	
	if( includeStart )
		var current = start;
	else
		var current = start+step;

	if( step === 1 )
	{
		if( includeEnd )
			return SWYM.rangeArray(current, end);
		else
			return SWYM.rangeArray(current, end-1);
	}

	var result = [];
	if( step > 0 )
	{
		while( current < end )
		{
			result.push(current);
			current += step;
		}
	}
	else
	{
		while( current > end )
		{
			result.push(current);
			current += step;
		}
	}
	
	if( includeEnd )
		result.push(end);
	return SWYM.jsArray(result);
}

SWYM.IsEqual = function(a,b, exact)
{
	if( a === b )
		return true;

	if( !a || !b )
		return a === b;
		
	if( exact && (a.type !== b.type || a.isChar !== b.isChar) )
		return false;

	if( a.type === "string" && b.type === "string" )
		return a.data === b.data;	
		
	// 0-length strings/arrays are equal
	if( a.length === 0 && b.length === 0 )
		return true;

	if( a.run === undefined || a.length === undefined || b.run === undefined || b.length === undefined )
		return a === b;
	
	if( a.length !== b.length )
		return false;
		
	for( var Idx = 0; Idx < a.length; ++Idx )
	{
		if (!SWYM.IsEqual(a.run(Idx), b.run(Idx), exact) )
			return false;
	}
	
	return true;
}

SWYM.GetOutput = function()
{
	return SWYM.PrintedOutput;
}

SWYM.ForceSingleValue = function(multivalue)
{
	if( !multivalue )
	{
		SWYM.LogError(-1, "Fsckup: unable to flatten <"+multivalue+">");
		return SWYM.value_novalues;
	}
	else if( multivalue.length === 0 )
	{
		return SWYM.value_novalues;
	}
	else if ( multivalue.length === 1 )
	{
		return multivalue.run(0);
	}
	else
	{
		SWYM.LogError(-1, "Expected single value, got <"+SWYM.ToMultiDebugString(multivalue)+">");
		return undefined;
	}
}

SWYM.SimpleCharRange = function(startCode, endCode, result)
{
	if( startCode < endCode )
	{
		for( var current = startCode; current <= endCode; ++current )
		{
			result += String.fromCharCode(current);
		}
	}
	else
	{
		for( var current = startCode; current >= endCode; --current )
		{
			result += String.fromCharCode(current);
		}
	}

	return result;
}

SWYM.CharRange = function(startStr,endStr)
{
	if( startStr === undefined )
	{
		SWYM.LogError(0, "Fsckup: Missing lhs when generating char range");
		return SWYM.StringWrapper("");
	}
	else if( endStr === undefined )
	{
		SWYM.LogError(0, "Fsckup: Missing rhs when generating char range");
		return SWYM.StringWrapper("");
	}
	if( startStr.length !== endStr.length )
	{
		SWYM.LogError(0, "Invalid char range ("+startStr.data+".."+endStr.data+") - examples must be of the same length");
		return startStr;
	}
	else if( startStr.length === 1 )
	{
		var startCode = startStr.data.charCodeAt(0);
		var endCode = endStr.data.charCodeAt(0);
		
		var Acode = "A".charCodeAt(0);
		var Zcode = "Z".charCodeAt(0);
		var acode = "a".charCodeAt(0);
		var zcode = "z".charCodeAt(0);

		var result = "";

		if( startCode >= Acode && startCode <= Zcode && endCode >= acode && endCode <= zcode )
		{
			// uppercase then lowercase (e.g. "B".."c" -> "BCbc")
			result = SWYM.SimpleCharRange(startCode,endCode+(Acode-acode), result);
			result = SWYM.SimpleCharRange(startCode+(acode-Acode),endCode, result);
		}
		else if( startCode >= acode && startCode <= zcode && endCode >= Acode && endCode <= Zcode )
		{
			// lowercase then uppercase (e.g. "b".."C" -> "bcBC")
			result = SWYM.SimpleCharRange(startCode,endCode+(acode-Acode), result);
			result = SWYM.SimpleCharRange(startCode+(Acode-acode),endCode, result);
		}
		else
		{
			// simple range
			result = SWYM.SimpleCharRange(startCode,endCode, result);
		}
		
		return SWYM.StringWrapper(result);
	}
	else
	{
		var rangeSteps = [];
		var rangeLength = 0;
		for( var Idx = 0; Idx < startStr.length; ++Idx )
		{
			var offset = endStr.data.charCodeAt(Idx) - startStr.data.charCodeAt(Idx);
			rangeSteps[Idx] = offset;
			if( offset !== 0 )
			{
				if( rangeLength !== 0 && rangeLength !== offset && rangeLength !== -offset )
				{
					SWYM.LogError(0, "Invalid multi-character range ("+startStr.data+".."+endStr.data+"). All characters must either remain unchanged, or change by an equal amount.");
					return startStr;
				}
				
				rangeLength = Math.abs(offset);
				if( offset > 0 )
				{
					rangeSteps[Idx] = 1;
				}
				else
				{
					rangeSteps[Idx] = -1;
				}
			}
		}
		
		// NB: <= because "A".."A" -> "A"
		var result = [];
		for( var rangeIdx = 0; rangeIdx <= rangeLength; ++rangeIdx )
		{
			var stringN = "";
			for( var stringIdx = 0; stringIdx < rangeSteps.length; ++stringIdx )
			{
				stringN += String.fromCharCode( startStr.data.charCodeAt(stringIdx) + rangeSteps[stringIdx]*rangeIdx );
			}
			result.push( SWYM.StringWrapper(stringN) );
		}
		return SWYM.jsArray(result);
	}
}

SWYM.ValueToClosure = function(val)
{
	if( val )
	{
		if( val.type === "string" )
			return SWYM.StringToClosure(val);
		else if ( val.type === "jsArray" )
			return SWYM.ArrayToClosure(val);
		else if ( val.type === "closure" )
			return val;
	}

	SWYM.LogError(-1, "Error, illegal argument: expected a callable, got "+SWYM.ToDebugString(arr));
}

SWYM.ArrayToClosure = function(arr)
{
	return {
		type: "closure",
		debugName: "<closure "+SWYM.ToDebugString(arr)+">",
		nativeCode: function(v){ return SWYM.jsArray([SWYM.ArrayContains(arr,v)]); }
	}
}

SWYM.StringToClosure = function(str)
{
	return {
		type: "closure",
		debugName: "<closure "+SWYM.ToDebugString(str)+">",
		nativeCode: function(c){ return SWYM.jsArray([SWYM.StringContainsChar(str,c)]); }
	}
}

SWYM.ToTerseString = function(value)
{
	var t = typeof value;
	switch(typeof value)
	{
		case "undefined": case "null": case "boolean": case "number": case "string":
			return ""+value;
	}
	
	switch(value.type)
	{
		case "variable":
			return SWYM.ToTerseString(value.value);
		case "string":
			return value.data;
		case "novalues":
			return "";
		case "jsArray":
		case "rangeArray":
		case "lazyArray":
			var result = "";
			if( value.length > 10000 )
			{
				for( var Idx = 0; Idx < 10000; Idx++ )
				{
					result += SWYM.ToTerseString(value.run(Idx));
				}
				result += "..."
			}
			else
			{
				for( var Idx = 0; Idx < value.length; Idx++ )
				{
					result += SWYM.ToTerseString(value.run(Idx));
				}
			}
			return result;
		
		case "swymClass": case "swymObject": case "closure":
		{
			return value.debugName;
		}

		default:
		{
			SWYM.LogError(0, "ToTerseString error: don't understand type "+value.type+" on <"+value+">");
			return "<ERROR>";
		}
	}
}

SWYM.ToMultiDebugString = function(value)
{
	if( !value ||  !value.run )
		return "<ToMultiDebugString fsckup!? ("+SWYM.ToDebugString(value)+")>";
	else if( value.length === 0 )
		return "<no values>";
	
	var result = SWYM.ToDebugString(value.run(0));
	var maxIdx = value.length;
	
	// failsafe
	if( maxIdx > 10010 )
		maxIdx = 10000;
	
	for( var Idx = 1; Idx < maxIdx; Idx++ )
	{
		result += "\n"+SWYM.ToDebugString(value.run(Idx));
	}
	
	if( maxIdx < value.length )
	{
		result += "\n..";
		if( value.length !== Infinity )
		{
			result += "\n..\n"+SWYM.ToDebugString(value.run(value.length-1));
		}
	}
	return result;
}

SWYM.ToDebugString = function(value, loopBreaker)
{	
	if( value === null )
	{
		return "void";
	}

	if( loopBreaker === undefined )
	{
		loopBreaker = 0;
	}
	else if( loopBreaker > 2 )
	{
		return "...";
	}
	
	var t = typeof value;	
	switch(t)
	{
		case "undefined": case "boolean": case "number":
			return ""+value;
		case "string":
			return "jsstring(\""+value+"\")";
	}
	
	switch(value.type)
	{
		case "novalues":
			return "<no_values>";
		case "variable":
			return "var("+SWYM.ToDebugString(value.getter? value.getter(): value.value, loopBreaker+1)+")";
			//return SWYM.ToDebugString(value.getter? value.getter(): value.value);
		case "string":
			if( value.debugString !== undefined )
			{
				return value.debugString;
			}
			
			var needsEscape = false;
			var debugString = '"';
			for( var Idx = 0; Idx < value.data.length; Idx++ )
			{
				if( value.data[Idx] === "\n" )
				{
					debugString += "\\n";
				}
				else if( value.data[Idx] === "\r" )
				{
					debugString += "\\r";
				}
				else if( value.data[Idx] === "\t" )
				{
					debugString += "\\t";
				}
				else
				{
					if( value.data[Idx] === "\"" || value.data[Idx] === "\\" )
					{
						// it needs escaping
						debugString += "\\";
					}
					debugString += value.data[Idx];
				}
			}
			
			debugString += '"';
			value.debugString = debugString;
			return debugString;
			
		case "jsArray":
			if( value.length === 0 )
				return "[]";
			
			var firstEntry = value.run(0);
			
			var result = SWYM.ToDebugString(firstEntry, loopBreaker);
			
			for( var Idx = 1; Idx < value.length; Idx++ )
			{
				var element = value.run(Idx);
				result += ","+SWYM.ToDebugString(element, loopBreaker);
			}
			
			return "["+result+"]";

		case "closure":
			return value.debugName;
			
		case "swymClass":
			if( value.debugName )
				return "class_"+value.debugName;
			else
				return "class_"+value.classID;

		case "table":
			var result = "";
			if( value.keys )
			{
				for( var Idx = 0; Idx < value.keys.length; Idx++ )
				{
					var key = value.keys.run(Idx);
					
					if( result !== "" )
						result += ", ";

					result += SWYM.ToDebugString(key, loopBreaker)+":"+SWYM.ToDebugString(value.run(key), loopBreaker);
				}
			}
			else
			{
				for( var memberName in value.data )
				{
					if( result !== "" )
						result += ", ";

					result += memberName+":"+SWYM.ToDebugString(value.data[memberName], loopBreaker);
				}
			}
			return "{"+result+"}";
		
		case "type":
			return value.debugName;

		case "struct":
		{
			if( value.structType.toDebugString !== undefined )
			{
				return SWYM.ToTerseString( value.structType.toDebugString(value) );
			}
			else
			{
				var result = "";
				for( var memberName in value.members )
				{
					if( result !== "" )
						result += ", ";

					result += memberName+"="+SWYM.ToDebugString(value.members[memberName], loopBreaker);
				}
				return value.structType.debugName+"("+result+")";
			}
		}

		case "lazyArray":
		{
			var result = SWYM.ToDebugString(value.run(0), loopBreaker);
			for( var Idx = 1; Idx < value.length && Idx < 3; ++Idx )
			{
				result += ","+SWYM.ToDebugString(value.run(Idx), loopBreaker);
			}
			if( value.length <= 3 )
				return "[" + result + "]";
			else
				return "[" + result + ",...]";
		}
		
		case "rangeArray":
		{
			if( value.length === 0 )
				return "[]";
			else if( value.length === 1 )
				return "["+value.first+"]";
			else if( value.length === 2 )
				return "["+value.first+","+value.last+"]";
			else
				return "["+value.first+".."+value.last+"]";
		}

		case "JSObject":
			return JSON.stringify(value.object);

		default:
			SWYM.LogError(-1, "ToDebugString error: don't understand type "+value.type+" on <"+value+">");
			return "";
	}
}

SWYM.ResolveBool_Some = function(array)
{
	for( var Idx = 0; Idx < array.length; Idx++ )
	{
		if( array.run(Idx) !== false )
			return true;
	}
	
	return false;
}

SWYM.ResolveBool_Every = function(array)
{
	for( var Idx = 0; Idx < array.length; Idx++ )
	{
		if( array.run(Idx) === false )
			return false;
	}
	
	return true;
}

SWYM.Distinct = function(array)
{
	var result = SWYM.jsArray([]);

	for( var Idx = 0; Idx < array.length; ++Idx )
	{
		var testValue = array.run(Idx);
		
		var found = false;
		for( var RIdx = 0; RIdx < result.length; ++RIdx )
		{
			if( SWYM.IsEqual(testValue, result[RIdx]) )
			{
				found = true;
				break;
			}
		}
		
		if( !found )
		{
			result.push(testValue);
		}
	}
	
	return result;
}

SWYM.DoIteration = function( debugName, array, curLevel, numLevels, stack, stackPosition, executable, rscope )
{
	var result = [];
	for( var Idx = 0; Idx < array.length; ++Idx )
	{		
		if( curLevel < numLevels )
		{
			result.push( SWYM.DoIteration( debugName, array.run(Idx), curLevel+1, numLevels, stack, stackPosition, executable, rscope ) );
		}
		else
		{
			var copyStack = [];
			copyStack.length = stack.length;
			for( var copyIdx = 0; copyIdx < stack.length; ++copyIdx )
			{
				copyStack[copyIdx] = stack[copyIdx];
			}
			copyStack[ stackPosition ] = array.run(Idx);

			result.push( SWYM.ExecWithScope( debugName+":ITER", executable, rscope, copyStack) );
		}
	}
	
	return SWYM.jsArray(result);
}

SWYM.onLoad("swymRuntime.js");