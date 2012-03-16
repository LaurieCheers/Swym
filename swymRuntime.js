SWYM.Exec = function(executable)
{
	SWYM.doFinalOutput = true;
	SWYM.MainRScope = object(SWYM.DefaultGlobalRScope);
	SWYM.g_etcState = {depth:0, halt:false};
	
	var result = SWYM.ExecWithScope("main", executable, SWYM.MainRScope);
}

SWYM.value_novalues = {type:"novalues"};

SWYM.ExecWithScope = function(debugName, executable, rscope)
{
	var PC = 0;
	var stack = [];
	while( PC < executable.length && !SWYM.halt )
	{
		switch(executable[PC])
		{
		case "#Literal":
			stack.push(executable[PC+1]);
			PC += 2;
			break;

		case "#ToMultivalue":
			var newValue = SWYM.jsArray([stack.pop()]);
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
			
		case "#Store":
			var varname = executable[PC+1];
			if( rscope[varname] !== undefined )
			{
				SWYM.LogError(0, "Variable "+varname+" already defined");
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
				SWYM.LogError(0, "Variable "+varname+" not defined");
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
				SWYM.LogError(0, "Variable "+varname+" is undefined");
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
				SWYM.LogError(0, "Fsckup: Trying to access "+varname+", but closure has no scope!?");
				return;
			}
			else if( closure.scope[varname] === undefined )
			{
				SWYM.LogError(0, "Fsckup: Closure variable "+varname+" is undefined");
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
				return SWYM.ExecWithScope(debugName, body, callScope);
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
				stack.push( SWYM.ExecWithScope(debugName, body, callScope) );
			}
			PC += 4;
			break;
			
		case "#Closure":
			var closureData = executable[PC+1];
			var newClosure =
			{
				type: "closure",
				debugName: closureData.debugName,
				argName:closureData.argName,
				body:closureData.body,
				scope: rscope,
				run:function(arg){ return SWYM.ClosureCall(this, arg); }
			}
			stack.push(newClosure);
			PC += 2;
			break;
			
		case "#ClosureCall":
			var closure = stack.pop();
			var arg = stack.pop();
			
			stack.push( SWYM.ClosureCall(closure, arg) );
			PC += 1;
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
			
		case "#Flatten":
			var list = stack.pop();
			stack.push( SWYM.Flatten(list) );
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
					SWYM.LogError(0, "at: Index out of bounds - "+SWYM.ToDebugString(table)+".at("+SWYM.ToDebugString(index)+")");
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
						SWYM.LogError(0, "at: Index out of bounds - "+SWYM.ToDebugString(table)+".at("+SWYM.ToDebugString(index)+")");
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
			if( variable.getter !== undefined )
				stack.push( variable.getter() );
			else
				stack.push( variable.value );
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
				stack.push( SWYM.ExecWithScope("IfYes", executable[PC+1], rscope) );
			else
				stack.push( SWYM.ExecWithScope("IfNo", executable[PC+2], rscope) );
			PC += 3;
			break;
		
		case "#Etc":
			var etcLimit = executable[PC+1];
			var etcBodyExecutable = executable[PC+2];
			var etcStepExecutable = executable[PC+3];
			var etcInitializer = executable[PC+4];
			var etcComposer = executable[PC+5];
			var etcPostProcessor = executable[PC+6];

			var limit = SWYM.ExecWithScope("EtcLimit", etcLimit, rscope);

			var newRScope = object(rscope);
			var etcData = {index:0};
			newRScope["<etcData>"] = etcData;
			var etcResult = etcInitializer();
			
			SWYM.g_etcState.depth++;
			SWYM.g_etcState.halt = false;

			for( var etcIndex = 0; etcIndex < limit; ++etcIndex )
			{
				etcData.index = etcIndex;
				var nextResult = SWYM.ExecWithScope("EtcBody", etcBodyExecutable, newRScope);

				if( etcStepExecutable !== undefined )
				{
					newRScope["<prevEtc>"] = nextResult;
					etcBodyExecutable = etcStepExecutable;
				}

				if( SWYM.g_etcState.halt )
					break;

				etcResult = etcComposer( etcResult, nextResult );

				if( SWYM.g_etcState.halt )
					break;
			}
			
			if( SWYM.g_etcState.halt && SWYM.halt && !SWYM.errors )
			{
				SWYM.halt = false;
			}

			SWYM.g_etcState.depth--;
			stack.push( etcPostProcessor(etcResult) );
			PC += 7;
			break;
			
		case "#EtcSequence":
			var etcGenerator = executable[PC+1];
			stack.push(etcGenerator(rscope["<etcData>"].index));
			PC += 2;
			break;
			
		case "#Return":
			var returnData = rscope["<returned>"];
			if( !returnData )
			{
				SWYM.LogError(0, "Fsckup: return value without any returnData!?");
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
			SWYM.ExecWithScope("ReceiveReturn", bodyExecutable, returnScope);
			if( !SWYM.halt )
			{
				SWYM.LogError(0, "Function failed to return at all!?");
			}
			else if( returnData.halt )
			{
				if( returnData.value === undefined )
				{
					SWYM.LogError(0, "Function failed to return a value!?");
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
			SWYM.ExecWithScope("ReceiveReturn", bodyExecutable, returnScope);
			
			if( SWYM.halt && returnData.halt && !SWYM.errors )
			{
				SWYM.halt = false;
			}
			PC += 2;
			break;
			
		default:
			//error!
			SWYM.LogError(0, "Error, SWYM.Exec can't understand opcode "+executable[PC]);
			return;
		}
	}
	
	if( SWYM.errors )
		return undefined;
	else if( stack !== [] )
		return stack.pop();
}

SWYM.CollectArgs = function(stack, numArgs)
{
	if( stack.length < numArgs )
	{
		SWYM.LogError(0, "Fsckup: should have "+numArgs+" items on the stack now, got only "+stack.length+"!");
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
		if( multivalue )
		{
			for( var Idx = 0; Idx < multivalue.length; Idx++ )
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
		for( var IdxA = 0; IdxA < multivalueA.length; IdxA++ )
		{
			for( var IdxB = 0; IdxB < multivalueB.length; IdxB++ )
			{
				result.push( body([multivalueA.run(IdxA), multivalueB.run(IdxB)]) );
			}
		}
	}
	else if( multiArgs.length === 3 )
	{
		// optimization for the 3 arg case
		var multivalueA = multiArgs[0];
		var multivalueB = multiArgs[1];
		var multivalueC = multiArgs[2];
		for( var IdxA = 0; IdxA < multivalueA.length; IdxA++ )
		{
			for( var IdxB = 0; IdxB < multivalueB.length; IdxB++ )
			{
				for( var IdxC = 0; IdxC < multivalueC.length; IdxC++ )
				{
					result.push( body([multivalueA.run(IdxA), multivalueB.run(IdxB), multivalueC.run(IdxC)]) );
				}
			}
		}
	}
	else
	{
		// the general (slowest?) case: apply recursively
		var multivalue = multiArgs[0];
		for( var Idx = 0; Idx < multivalue.length; Idx++ )
		{
			var value = multivalue[Idx];
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

SWYM.jsArray = function(array)
{
	array.type = "jsArray";
	array.run = function(idx){ return this[idx]; };
	return array;
}

SWYM.StringWrapper = function(str)
{
	if( str === undefined )
		return undefined;
	else
		return {type:"string", run: function(idx){ if(idx >= 0 && idx < str.length) return SWYM.StringWrapper(this.data[idx]); }, length:str.length, data:str};
}

SWYM.ArrayContains = function(array, value)
{
	for( var Idx = 0; Idx < array.length; Idx++ )
	{
		if( SWYM.IsEqual( array[Idx], value ) )
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
		SWYM.LogError(0, "Fsckup: tried to Flatten '"+subArray+"'");
	}
	else
	{
		for(var Idx = 0; Idx < array.length; ++Idx )
		{
			var subArray = array.run(Idx);
			if( !subArray || subArray.length === undefined )
			{
				SWYM.LogError(0, "Fsckup: SWYM.Flatten encountered invalid sub-array: "+subArray);
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

SWYM.ClosureCall = function(closure, arg)
{
	if ( closure.body )
	{
		var callScope = object(closure.scope)
		callScope[closure.argName] = arg;
		return SWYM.ExecWithScope(closure.debugName, closure.body, callScope);
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
		SWYM.LogError(0, "'"+SWYM.ToDebugString(closure)+"' is not a callable object!");
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
		
	var result = SWYM.jsArray([]);
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
	return result;
}

SWYM.IsEqual = function(a,b)
{
	if( !a || !b )
		return a === b;

	if( a.type === "string" && b.type === "string" )
		return a.data === b.data;
		
	// 0-length strings/arrays are equal
	if( a.length === 0 && b.length === 0 )
		return true;

	if( a.type !== "jsArray" || b.type !== "jsArray" )
		return a === b;
	
	if( a.type !== b.type || a.length !== b.length )
		return false;
		
	for( var Idx = 0; Idx < a.length; ++Idx )
	{
		if (!SWYM.IsEqual(a[Idx], b[Idx]) )
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
		SWYM.LogError(0, "Fsckup: unable to flatten <"+multivalue+">");
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
		SWYM.LogError(0, "Expected single value, got <"+SWYM.ToMultiDebugString(multivalue)+">");
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
	var Acode = "A".charCodeAt(0);
	var Zcode = "Z".charCodeAt(0);
	var acode = "a".charCodeAt(0);
	var zcode = "z".charCodeAt(0);
	var zerocode = "0".charCodeAt(0);
	var ninecode = "9".charCodeAt(0);
	var startCode = startStr.data.charCodeAt(0);
	var endCode = endStr.data.charCodeAt(0);

	var result = "";

	if( startCode >= Acode && startCode <= Zcode )
	{
		if( endCode >= Acode && endCode <= Zcode )
		{
			// simple uppercase range
			return SWYM.StringWrapper( SWYM.SimpleCharRange(startCode,endCode, result) );
		}
		else if( startCode === Zcode )
		{
			// start with reversed uppercase...
			result = SWYM.SimpleCharRange(startCode,Acode, result);
		}
		else
		{
			// start with uppercase...
			result = SWYM.SimpleCharRange(startCode,Zcode, result);
		}
	}
	else if( startCode >= acode && startCode <= zcode )
	{
		if( endCode >= acode && endCode <= zcode )
		{
			// simple lowercase range
			return SWYM.StringWrapper( SWYM.SimpleCharRange(startCode,endCode, result) );
		}
		else if( startCode === zcode )
		{
			// start with reversed lowercase...
			result = SWYM.SimpleCharRange(startCode,acode, result);
		}
		else
		{
			// start with lowercase...
			result = SWYM.SimpleCharRange(startCode,zcode, result);
		}
	}
	else if( startCode >= zerocode && startCode <= ninecode )
	{
		if( endCode >= zerocode && endCode <= ninecode )
		{
			// simple number range
			return SWYM.StringWrapper( SWYM.SimpleCharRange(startCode,endCode, result) );
		}
		else if( startCode === ninecode )
		{
			// start with reversed digits...
			result = SWYM.SimpleCharRange(startCode,zerocode, result);
		}
		else
		{
			// start with digits...
			result = SWYM.SimpleCharRange(startCode,ninecode, result);
		}
	}
	
	if( endCode == Acode )
	{
		// ...then reversed uppercase
		result = SWYM.SimpleCharRange(Zcode,endCode, result);
	}
	else if( endCode == acode )
	{
		// ...then reversed lowercase
		result = SWYM.SimpleCharRange(zcode,endCode, result);
	}
	else if( endCode == zerocode )
	{
		// ...then reversed digitscase
		result = SWYM.SimpleCharRange(ninecode,endCode, result);
	}
	else if( endCode >= Acode && endCode <= Zcode )
	{
		// ...then uppercase
		result = SWYM.SimpleCharRange(Acode,endCode, result);
	}
	else if( endCode >= acode && endCode <= zcode )
	{
		// ...then lowercase
		result = SWYM.SimpleCharRange(acode,endCode, result);
	}
	else if( endCode >= zerocode && endCode <= ninecode )
	{
		// ...then digits
		result = SWYM.SimpleCharRange(zerocode,endCode, result);
	}

	return SWYM.StringWrapper(result);
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

	SWYM.LogError(0, "Error, illegal argument: expected a callable, got "+SWYM.ToDebugString(arr));
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
		case "undefined": case "null": case "boolean": case "number":
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
			if( value.length === 0 )
				return "";
			
			var result = SWYM.ToTerseString(value.run(0));
			for( var Idx = 1; Idx < value.length; Idx++ )
			{
				result += SWYM.ToTerseString(value.run(Idx));
			}
			return result;
		
		case "swymClass": case "swymObject": case "closure":
			return value.debugName;

		default:
			return "ToTerseString error: don't understand type "+value.type+" on <"+value+">";
	}
}

SWYM.ToMultiDebugString = function(value)
{
	if( !value ||  !value.run )
		return "<ToMultiDebugString fsckup!? ("+value+")>";
	else if( value.length === 0 )
		return "<no values>";
	
	var result = SWYM.ToDebugString(value.run(0));
	for( var Idx = 1; Idx < value.length; Idx++ )
	{
		result += "\n"+SWYM.ToDebugString(value.run(Idx));
	}
	return result;
}

SWYM.ToDebugString = function(value)
{
	if( value === null )
	{
		return "void";
	}
	
	var t = typeof value;	
	switch(t)
	{
		case "undefined": case "boolean": case "number":
			return ""+value;
	}
	
	switch(value.type)
	{
		case "variable":
			return "(var)"+SWYM.ToDebugString(value.getter? value.getter(): value.value);
			//return SWYM.ToDebugString(value.getter? value.getter(): value.value);
		case "string":
			return '"'+value.data+'"';
		case "novalues":
			return "<no_values>";
		case "jsArray":
			if( value.length === 0 )
				return "[]";
			
			var firstEntry = value.run(0);
			
			var result = SWYM.ToDebugString(firstEntry);
			
			for( var Idx = 1; Idx < value.length; Idx++ )
			{
				var element = value.run(Idx);
				result += ","+SWYM.ToDebugString(element);
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

					result += SWYM.ToDebugString(key)+":"+SWYM.ToDebugString(value.run(key));
				}
			}
			else
			{
				for( var memberName in value.data )
				{
					if( result !== "" )
						result += ", ";

					result += memberName+":"+SWYM.ToDebugString(value.data[memberName]);
				}
			}
			return "{"+result+"}";
		
		case "type":
			return value.debugName;

		case "struct":
		{
			var result = "";
			for( var memberName in value.members )
			{
				if( result !== "" )
					result += ", ";

				result += memberName+":"+SWYM.ToDebugString(value.members[memberName]);
			}
			return value.structType.debugName+"("+result+")";
		}

		default:
			SWYM.LogError(0, "ToDebugString error: don't understand type "+value.type+" on <"+value+">");
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
			if( SWYM.IsEqual(testValue, result.run(RIdx)) )
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