
SWYM.isSwymArray = function(a)
{
	return a && a.isSwymArray;
}

SWYM.isSwymString = function(a)
{
	if( !SWYM.isSwymArray(a) )
		return false;
		
	if( a.isSwymStringQuick )
		return true;
		
	var containsAllChars = SWYM.MultiExecUntilFirst(a, function(an)
	{
		if( !an || !an.value || !an.value.swymChar )
			return false;
	}, true);
	
	return containsAllChars;
}

SWYM.getArrayLength = function(array)
{
	if ( typeof array === "string" )
		return array.length;

	return array.getLength();
}

SWYM.addKeyValue = function(array, key, value)
{
	array.addKeyValue(key, value)
}

SWYM.indexOp = function(array, index, fromEnd)
{
		if( !array || !SWYM.isSwymArray(array) )
		{
			SWYM.LogError(0, "Fsckup: Non-array value in indexOp");
			return {value:undefined, halt:true};
		}

		var foundCell;

		if( fromEnd )
		{
			if( array.getElementFromEnd )
				foundCell = array.getElementFromEnd(index);
			else
				foundCell = array.getElement( SWYM.getArrayLength(array)-1-index );
		}
		else
			foundCell = array.getElement(index);

		if( foundCell )
			return foundCell;

		// out of bounds
		if ( SWYM.scope["#outOfBoundsHalt"].value === true )
			return {value:null, halt:true, outOfBoundsHalt:true};
		else
			return {value:null};
//	}
}

SWYM.MultiExec = function(multival, exp, isInternalCall)
{
	if( multival && multival.halt )
		return multival;

	var meresult;
	if( multival && SWYM.isSwymArray(multival) )
	{
		// step through the values
		meresult = SWYM.NewArray(multival.resolve);
		var length = SWYM.getArrayLength(multival);
		
		for (var Idx = 0; Idx < length; Idx++)
		{
			var temp = SWYM.MultiExec(SWYM.indexOp(multival,Idx), exp, true);
			if( temp )
			{
				if( temp.halt )
					return temp;
				else
					meresult.push( temp );
			}
		}
	}
	else
	{
		meresult = exp(multival);
	}

	if( isInternalCall || meresult )
	{
		return meresult;
	}
	else
	{
		// normally, if there's nothing else to return, return an empty multivalue
		return SWYM.NewArray(multival? multival.resolve: undefined); 
	}
}

SWYM.MultiExecUntilFirst = function(multival, exp, resultIfNone)
{
	if( multival.halt )
		return multival;

	var meresult;

	if( multival && SWYM.isSwymArray(multival) )
	{
		// step through the values
		meresult = SWYM.NewArray(multival.resolve);
		var length = SWYM.getArrayLength(multival);
		
		for (var Idx = 0; Idx < length; Idx++)
		{
			var temp = SWYM.MultiExecUntilFirst(SWYM.indexOp(multival,Idx), exp, undefined);
			if( temp !== undefined )
				return temp;
		}
	}
	else
	{
		var temp = exp(multival);
		if( temp !== undefined )
			return temp;
	}

	return resultIfNone;
}

SWYM.MultiExecLazy = function(baseArray, exp, resolveFn, is1to1)
{
	var cached = [];
	var nextUncached = 0;
	var baseLength = SWYM.getArrayLength(baseArray);
//	var lazyDataFromEnd = []; // in reverse order - last element of the array is at [0]

	var Cache;
	var CacheFromEnd;
	if(is1to1)
	{
		Cache = function(index)
		{
			if( !cached[index] && index >= 0 && index < baseLength )
			{
				var baseElement = SWYM.indexOp(baseArray, index);
				if( baseElement )
				{
					var result = exp(baseElement);
					cached[index] = result;
				}
			}
		}
		
		CacheFromEnd = function(rindex)
		{
			Cache((baseLength-rindex)-1);
		}
	}
	else
	{
		var cachedFromEnd = []; // in reverse order: cachedFromEnd[0] is the last element in the list
		var nextUncachedFromEnd = baseLength-1; // index into the base list. NB normal ordering, not reversed.

		function MergeCaches()
		{
			if( nextUncached <= nextUncachedFromEnd )
				return;
			
			for(var Idx = cachedFromEnd.length-1; Idx >= 0; Idx++ )
			{
				cached.push(cachedFromEnd[Idx]);
			}
			cachedFromEnd = undefined;

			Cache = function(index){};
			CacheFromEnd = function(rindex){};
		}

		Cache = function(index)
		{
			while( cached.length <= index && nextUncached <= nextUncachedFromEnd )
			{
				var baseElement = SWYM.indexOp(baseArray, nextUncached);
				var ourElement = exp(baseElement);
				if( ourElement )
					cached.push(ourElement);
				nextUncached++;
			}
			
			MergeCaches();
		}

		CacheFromEnd = function(rindex)
		{
			while( cachedFromEnd.length <= rindex && nextUncachedFromEnd >= nextUncached )
			{
				var baseElement = SWYM.indexOp(baseArray, nextUncachedFromEnd);
				var ourElement = exp(baseElement);
				if( ourElement )
					cachedFromEnd.push(ourElement);
				nextUncachedFromEnd--;
			}

			MergeCaches();
		}
	}

	var result = {
		"(cached)": cached, // for debug only
		isSwymArray:true,
		resolve: resolveFn,
		getElement: function(index)
		{
			Cache(index);
			return cached[index];
		},
		getElementFromEnd: function(rindex)
		{
			CacheFromEnd(rindex);
			if( cachedFromEnd && cachedFromEnd.length > rindex )
				return cachedFromEnd[rindex];
			else
				return cached[(cached.length-rindex)-1];
		},
		getLength:	is1to1? function(){ return baseLength; }: function()
		{
			Cache(baseLength);
			return cached.length;
		},
		toString: SWYM.SWYMArrayToString
	};
	
	result.patternTest = SWYM.ArrayContentTester(result);
	return result;
}

SWYM.LazyEtcSequence = function(parsetree)
{
	var stringVersion = parsetree.toString();

	return {
		getElement: function(index)
		{
			return cached[index];
		},
		toString: function(){ return stringVersion; }
	};
}

SWYM.LazyReverse = function(baseArray)
{
	var baseLength = SWYM.getArrayLength(baseArray);
	
	var ToString = function()
	{
		var str = "";
		var e
		SWYM.MultiExec(this, function(arg)
		{
			if(str)
				str += ",";
			str += arg.value;
		});
		return "["+str+"]";
	}

	var result = {
		isSwymArray:true,
		resolve: undefined,
		getElement: function(index){ return SWYM.indexOp(baseArray, (baseLength-index)-1); },
		getLength: function(){ return baseLength; },
		toString: SWYM.SWYMArrayToString
	};
	
	result.patternTest = SWYM.ArrayContentTester(result);
	return result;
}

SWYM.NewArray = function(resolveFn, baseArray)
{
	var theArray = [];

	if( baseArray )
	{
		for( var Idx = 0; Idx < baseArray.length; Idx++ )
		{
			theArray.push(baseArray[Idx]);
		}
	}
	
	var getElement = function(n)
	{
		if( typeof n === "number" )
			return theArray[n];
		else
			return theArray[n.getRawString()];
	}
	
	var addKeyValue = function(k,v)
	{
		if( typeof k === "number" )
			theArray[k] = v;
		else
			theArray[k.getRawString()] = v;
	}
	
	var getKeys = function()
	{
		var result = SWYM.NewArray();
		for( var key in theArray )
		{
			result.push({value:SWYM.StringWrapper(key)});
		}
		return result;
	}
	
	var result = {
		isSwymArray:true,
		temporary:true,
		resolve: resolveFn,
		push:		function(v){ return theArray.push(v); },
		addKeyValue:addKeyValue,
//		addKeyValue:function(k,v){ if( typeof k === "number" ){ theArray[k] = v; }else{ theHashKeys.push({value:k}); theHashValues.push(v); }},
		getElement:	getElement,
		getElementFromEnd: function(r) { return this.getElement((this.getLength()-r)-1); },
		getKeys: getKeys,
//		getKeys: function(){ return SWYM.NewArray(undefined, theHashKeys); },
		getLength:	function() { return theArray.length; },
		toString:	function() { return SWYM.ArrayToString(theArray); }
	};

    result.patternTest = SWYM.ArrayContentTester(result);
	result["(theArray)"] = theArray; // for debug only
	
	return result;
}

SWYM.StringWrapper = function(str)
{
	var result = {
		isSwymArray:true,
		patternTest: function(v)
		{
			if( v && v.value )
			{
				var swymChar = v.value.swymChar;
				if( swymChar )
				{
					for( var Idx = 0; Idx < str.length; Idx++ )
					{
						if( str[Idx] === swymChar )
							return true;
					}
				}
			}

			return false;
		},
		getElement:	function(n)
		{
			if( str[n] === undefined )
				return undefined;
			else
				return {value:SWYM.CharWrapper(str[n]), homeContext:result, homeIndex:n};
		},
		getElementFromEnd: function(r) { return this.getElement((this.getLength()-r)-1); },
		getLength:	function() { return str.length; },
		toString:	function() { return "\""+str+"\""; },
		getRawString:	function() { return str; }
	};
	
	result["(theString)"] = str; // for debug only
	return result;
}

SWYM.CharWrapper = function(c)
{
	return {swymChar:c, toString:function(){return "'"+this.swymChar+"'"}};
}

SWYM.ArrayContains = function(array, cell)
{
	return SWYM.MultiExecUntilFirst(array, function(element)
	{
		if( SWYM.isEqualValue(element.value, cell.value) )
			return true;
	}, false);
}

SWYM.ArrayContentTester = function(array)
{
    return function(cell){ return SWYM.ArrayContains(array,cell); };
}


//===============================================================
//===============================================================

//=============================================================

SWYM.GetOutput = function()
{
	return SWYM.PrintedOutput;
}

// The primary Exec function, called only by the interpreter.
SWYM.Exec = function(parsetree)
{
	SWYM.scope = object(SWYM.DefaultGlobalScope);
	SWYM.PrintedOutput = "";
	var result = SWYM.ExecDefault(parsetree);
	
	result = SWYM.Resolve(result);
	
	if ( SWYM.PrintedOutput === "" && result )
	{
		SWYM.MultiExec(result, function(cell)
		{
			if( !cell )
				SWYM.LogError(0, "Fsckup: Undefined result cell");
			else
			{
				var out = ""+cell.value;
				
				if( SWYM.PrintedOutput && out )
					SWYM.PrintedOutput+= "\n";
			
				SWYM.PrintedOutput += out;
			}
		});
	}
}

SWYM.ExecNode = function(parsetree)
{
	if( parsetree.op.behaviour.customExec )
	{
		return parsetree.op.behaviour.customExec(parsetree);
	}
	else
	{
		var lhsResult = SWYM.ExecDefault(parsetree.children[0]);
		if( lhsResult && lhsResult.halt )
			return lhsResult;
		
		var rhsResult = SWYM.ExecDefault(parsetree.children[1]);
		if( rhsResult && rhsResult.halt )
			return rhsResult;
			
		return SWYM.MultiExec(lhsResult, function(lv){
			return SWYM.MultiExec(rhsResult, function(rv){
				return SWYM.ExecOp(lv,parsetree.op,rv);
			});
		});
	}
}

SWYM.ExecBox = function(parsetree)
{
	var result = {value:SWYM.NewArray()};

	var processNode = function(subtree)
	{
		if( !subtree )
			return;

		if( subtree.type === "node" )
		{
			if( subtree.op.text === ";" || subtree.op.text === ",")
			{
				processNode(subtree.children[0]);
				if( !result.halt )
				{
					processNode(subtree.children[1]);
				}
				return;
			}
			else if ( subtree.op.text === ":" )
			{
				if( !subtree.children[0] )
				{
					SWYM.LogError(subtree.pos, "Expected: Name before : operator");
				}

				var rv = SWYM.ExecDefault(subtree.children[1]);
				if( rv.halt )
				{
					result.value = rv;
				}
				else if( subtree.children[0].type === "name" )
				{
					SWYM.addKeyValue(result.value, SWYM.StringWrapper(subtree.children[0].text), rv );
				}
				else if( subtree.children[0].type === "literal" || (subtree.children[0].type === "node" && subtree.children[0].op.text === "(parentheses())") )
				{
					var lv = SWYM.ExecDefault(subtree.children[0]).value;

					if( lv.halt )
						result = lv;
					else
						SWYM.addKeyValue(result.value, lv, rv );

					return;
				}
				else
				{
					SWYM.LogError(subtree.pos, "Illegal name declaration within []");
				}
				return;
			}
		}
		
		var sv = SWYM.ExecDefault(subtree);
		if( sv.halt )
		{
			result = sv;
		}
		else
		{
			SWYM.MultiExec(sv, function(svn)
			{
				result.value.push(svn);
			});
		}
	}
	
	for( var Idx = 0; Idx < parsetree.children.length; Idx++ )
	{
		processNode(parsetree.children[Idx]);
	}
	return result;
}

SWYM.ExecDefault = function(parsetree)
{
	if ( !parsetree )
		return undefined;
	
    switch ( parsetree.type )
	{
	case "name":
		{
			var lookedUp = SWYM.scope[parsetree.text];
			if ( !lookedUp )
			{
				SWYM.LogError(parsetree.pos, "Undeclared identifier '"+parsetree.text+"'");
				return {value:undefined, halt:true};
			}
			else
				return lookedUp;
		}
		break;
	case "custom":
		{
			return parsetree.exec();
		}
		break;
	case "rawdata":
		{
			return parsetree.value;
		}
	case "literal":
		{
			if ( parsetree.etcSequence )
			{
				return {value:SWYM.ResolveEtcSequence(parsetree.etcSequence, SWYM.scope["#etcIndex"+parsetree.etcId].value)};
			}
			else if ( parsetree.value === undefined )
			{
				SWYM.LogError(parsetree.pos, "Undefined literal(!?!) '"+parsetree.value+"'");
				return {value:undefined};
			}
			else
			{
				if (typeof parsetree.value === "string")
				{
					if( parsetree.text === "'"+parsetree.value+"'" )
					{
						parsetree.value = SWYM.CharWrapper(parsetree.value);
					}
					else
					{
						parsetree.value = SWYM.StringWrapper(parsetree.value);
					}
				}
				
				return {value:parsetree.value};
			}
		}
		break;
	case "node":
		{
			var etcIndex = ( parsetree.etcExpandAround === undefined )?
					undefined:
					SWYM.scope["#etcIndex"+parsetree.etcId].value;

			if( etcIndex <= 0 )
			{
				return SWYM.ExecDefault(parsetree.children[parsetree.etcExpandAround]);
			}

			if( parsetree.op.behaviour.customExec )
			{
				return parsetree.op.behaviour.customExec(parsetree);
			}

			if ( parsetree.etcExpandAround !== undefined )
			{
				if ( parsetree.etcExpandAround == 0 )
				{
					SWYM.scope["#etcIndex"+parsetree.etcId].value--;
					var lhsResult = SWYM.ExecDefault(parsetree);
					SWYM.scope["#etcIndex"+parsetree.etcId].value = etcIndex;
					if( lhsResult && lhsResult.halt )
						return lhsResult;
					
					var rhsResult = SWYM.ExecDefault(parsetree.children[1]);
				}
				else
				{
					var lhsResult = SWYM.ExecDefault(parsetree.children[0]);
					if( lhsResult && lhsResult.halt )
						return lhsResult;
					
					SWYM.scope["#etcIndex"+parsetree.etcId].value--;
					var rhsResult = SWYM.ExecDefault(parsetree);
					SWYM.scope["#etcIndex"+parsetree.etcId].value = etcIndex;
				}
			}
			else
			{
				var lhsResult = SWYM.ExecDefault(parsetree.children[0]);
				if( lhsResult && lhsResult.halt )
					return lhsResult;

				var rhsResult = SWYM.ExecDefault(parsetree.children[1]);
			}
			
			if( rhsResult && rhsResult.halt )
				return rhsResult;

			return SWYM.MultiExec(lhsResult, function(lv){
				return SWYM.MultiExec(rhsResult, function(rv){
					return SWYM.ExecOp(lv,parsetree.op,rv);
				});
			});
		}
		break;
	case "etc":
		{
			//if ( parsetree.op.text === "," && !parsetree.haltBefore && !parsetree.haltAfter )
			//{
			//	return SWYM.LazyEtcSequence(parsetree);
			//}
			
            var etcIdx = 0;
            var etcIdxCell = SWYM.scope["#etcIndex"+parsetree.etcId];
            
            if( !etcIdxCell )
            {
				etcIdxCell = {value:undefined};
				SWYM.DefaultGlobalScope["#etcIndex"+parsetree.etcId] = etcIdxCell;
            }

            var oldEtcIdx = etcIdxCell.value;

            var accumulatedResults = undefined;
            
            var haltCell = undefined;
            if( parsetree.haltExpression )
            {
				haltCell = SWYM.ExecDefault(parsetree.haltExpression);
				
				if( haltCell.halt )
				{
					return haltCell;
				}
				else if ( !haltCell )
				{
					SWYM.LogError(parsetree.pos, "Undefined literal(!?!) '"+parsetree.value+"'");
					return {value:undefined, halt:true};
				}
			}

			var oldOOBH = SWYM.scope["#outOfBoundsHalt"].value;
			SWYM.scope["#outOfBoundsHalt"].value = true;

            while(etcIdx < 1000) //Hack - hard cap 1000 iterations to avoid infinite loops.
            {
                etcIdxCell.value = etcIdx;
                var resultsThisStep = SWYM.ExecDefault(parsetree.body);
				
				if( resultsThisStep.halt )
				{
					if( resultsThisStep.outOfBoundsHalt ) // reached the end of the list, we can break the loop now.
						break;
					else // an error occurred.
						return resultsThisStep;
				}
                
                var shouldHalt = undefined;
                if( parsetree.haltCondition )
				{
					shouldHalt = parsetree.haltCondition(resultsThisStep, haltCell, etcIdx);
				}
				
				if( shouldHalt == SWYM.HALT_BEFORE )
				{
					break;
				}
                else if ( !accumulatedResults )
                {
                    accumulatedResults = resultsThisStep;
                }
				else if ( parsetree.op.text === "||" )
				{
					if( SWYM.isTruthy(resultsThisStep.value) )
					{
						accumulatedResults = resultsThisStep;
						break;
					}
				}
				else if ( parsetree.op.text === "&&" )
				{
					if( !SWYM.isTruthy(resultsThisStep.value) )
					{
						accumulatedResults = resultsThisStep;
						break;
					}
				}
                else if ( parsetree.op.text === "," )
				{
					accumulatedResults = SWYM.CommaOp(accumulatedResults, resultsThisStep);
				}
				else
                {
                    accumulatedResults = SWYM.MultiExec(accumulatedResults, function(accV)
					{
						return SWYM.MultiExec(resultsThisStep, function(resV)
						{
							return SWYM.ExecOp(accV, parsetree.op, resV);
						});
					});
                }
                
				if( shouldHalt == SWYM.HALT_AFTER )
				{
					break;
				}
                etcIdx++;
            }
            
            if( !accumulatedResults )
            {
                accumulatedResults = SWYM.NewArray();
                
                // zero terms! fill in a default if appropriate
                if( parsetree.op.text === "+" )
                    accumulatedResults.push({value:0});
                else if ( parsetree.op.text === "*" )
                    accumulatedResults.push({value:1});
                else if ( parsetree.op.text === "||" )
                    accumulatedResults.push({value:false});
                else if ( parsetree.op.text === "&&" )
                    accumulatedResults.push({value:true});
            }
            
            etcIdxCell.value = oldEtcIdx;
            SWYM.scope["#outOfBoundsHalt"].value = oldOOBH;
			
			return accumulatedResults;
        }
		break;
	default:
		{
			SWYM.LogError(parsetree.pos, "Invalid parse tree node: "+parsetree);
			return {value:undefined, halt:true};
		}
	}
}

SWYM.ExecOp = function(lval, optoken, rval)
{
	if ( optoken )
	{
		var mode;
		if ( lval !== undefined && rval !== undefined )
			mode = "infix";
		else if ( lval !== undefined )
			mode = "postfix";
		else if ( rval !== undefined )
			mode = "prefix";
		else
			mode = "standalone";

		if ( !optoken.behaviour[mode] )
		{
			if ( (mode == "postfix" && optoken.behaviour.infix) || (mode == "standalone" && optoken.behaviour.prefix) )
			{
				SWYM.LogError(optoken.pos, "Missing right-hand side for operator '"+optoken.text+"'");
			}
			else
			{
				SWYM.LogError(optoken.pos, "Operator "+optoken.text+" cannot be used "+mode);
			}
			return null;
		}
		else
		{
			optoken.activeBehaviour = optoken.behaviour[mode];
			var result = optoken.activeBehaviour(lval, rval, optoken);
            if ( !result )
            {
                SWYM.LogError(0, "Fsckup: Node <"+lval+">"+optoken+"<"+rval+"> didn't return a value");
                return {value:undefined, halt:true};
            }
            else
            {
                return result;
            }
		}
	}
	else if ( lval != undefined )
	{
		return lval;
	}
	else if ( rval != undefined )
	{
		return rval;
	}
	else
	{
		return undefined;
	}
}

//=========================================================
//=========================================================

// a temporary list may contain lvalues. When we store the list, we strip those lvalues out.
SWYM.MakeStorable = function(value)
{
	if ( !SWYM.isSwymArray(value) || !value.temporary )
		return value;

	var result = SWYM.MultiExec(value, function(arri)
	{
		if ( arri && arri.value && arri.value.temporary )
		{
			return {value:SWYM.MakeStorable(arri.value)};
		}
		else
		{
			return arri;
		}
	});
	result.temporary = false;
	return result;
}

/*
SWYM.ArrayToString = function()
{
	var result = "";
	var inBrackets = false;
	
	if( this.length === 0 )
		return "[]";
	
	for(var Idx = 0; Idx < this.length; Idx++)
	{
		if ( !this[Idx] )
		{
			result += ",?"+this[Idx]+"?";
		}
		else if ( this[Idx].value && this[Idx].value.swymChar )
		{
			if( inBrackets )
				result += "]";
			
			inBrackets = false;			
			result += this[Idx].value;
		}
		else
		{
			if( inBrackets )
				result += ",";
			else
				result += "[";

			inBrackets = true;
			result += this[Idx].value;
		}
	}
	
	if( inBrackets )
		result += "]";

	return result;
}
*/

SWYM.ArrayToStringGeneric = function(iterator)
{
	var result = "";
	var firstEntry = true;
	var stringResult = "";
	
	iterator(function(arg)
	{
		if( stringResult !== undefined && arg && arg.value && arg.value.swymChar )
			stringResult += arg.value.swymChar;
		else
			stringResult = undefined;
		
		if( !firstEntry )
			result += ",";

		if( arg )
			result += arg.value;
		else
			result += "(undefined)";
		firstEntry = false;
	});
	
	if( stringResult )
		return "\""+stringResult+"\"";
	else
		return "["+result+"]";
}

SWYM.ArrayToString = function(array)
{
	if( !array )
		array = this;
	return SWYM.ArrayToStringGeneric( function(step)
	{
		for( var Idx = 0; Idx < array.length; Idx++ )
		{
			step(array[Idx]);
		}
	});
}

SWYM.SWYMArrayToString = function()
{
	var array = this;
	return SWYM.ArrayToStringGeneric( function(step)
	{
		SWYM.MultiExec(array, step)
	});
}

// If it's a string value, return the raw string; if not, convert to a string.
SWYM.getRawString = function(v)
{
	if( !v )
	{
		return "(undefined)";
	}
	else if( v.getRawString )
	{
		return v.getRawString();
	}
	else if( SWYM.isSwymString(v) )
	{
		var result = "";
		SWYM.MultiExec(v, function(vn)
		{
			result += vn.value.swymChar;
		});
		return result;
	}
	else
	{
		return ""+v;
	}
}

SWYM.Prettify = function(input, separator)
{
	var result = "";
	var firstEntry = true;

	SWYM.MultiExec(input, function(v)
	{
		if( firstEntry && separator )
			result += separator;
		
		if( !v || v.value === undefined )
		{
			result += "(undefined)";
		}
		else if ( SWYM.isSwymString(v.value) )
		{
			result += SWYM.getRawString(v.value);
		}
		else if (SWYM.isSwymArray(v.value))
		{
			// recurse
			result += SWYM.Prettify(v.value);
		}
		else if( v.value && v.value.swymChar )
		{
			result += v.value.swymChar;
		}
		else
		{
			result += v.value;
		}
		
		firstEntry = false;
	});
	
	return result;
}

//=============================================================

SWYM.parseFunctionArguments = function(arguments, argTypes, argNames, hasHash)
{	
	function addArgument(arg)
	{
		if( arg.type === "node" && arg.op.text === "(parentheses())" )
			arg = arg.children[0];
			
		if( !arg )
			return;
		
		if( arg.type === "node" && arg.op.text === "," )
		{
			addArgument(arg.children[0]);
			addArgument(arg.children[1]);
		}
		else if( arg.type === "node" && arg.op.text === ":" )
		{
			if ( arg.children[0] && arg.children[0].type === "name" )
			{
				// ordinary declaration
				argNames.push(arg.children[0].text);

				var typeCell = SWYM.ExecDefault(arg.children[1]);
				if( typeCell )
					argTypes.push(typeCell.value);
				else
					argTypes.push(SWYM.DefaultGlobalScope.Value.value);
			}
			else if ( arg.children[0] && arg.children[0].op && arg.children[0].op.functionName )
			{
				// Found a function declaration... I'll just declare it as a parameter of type Function.
				// (ToDo: parse this declaration properly.)
				argNames.push(arg.children[0].op.functionName);
				argTypes.push(SWYM.DefaultGlobalScope.Function.value);
			}
			else
			{
				SWYM.LogError(arg.op.pos, "Invalid parameter name "+arg.children[0]+"'");
			}
		}
		else
		{
			argNames.push(null);
			var argResult = SWYM.ExecDefault(arg);
			if( argResult && argResult.value )
			{
				argTypes.push(argResult.value);
			}
		}
	};
	
	
	addArgument(arguments[0]);
	
	if( hasHash ) // if a function has a # in the name, it gets a free second parameter, called '#'.
	{
		argTypes.push(SWYM.DefaultGlobalScope.Int.value);
		argNames.push("#");
	}
	
	for( var Idx = 1; Idx < arguments.length; Idx++ )
	{
		addArgument(arguments[Idx]);
	}
	
	if( argNames[0] === null )
		argNames[0] = "it";
}

SWYM.PatternTestFunc = function(fn)
{
	fn.patternTest = function(toTest)
	{
		var cond = fn([toTest]);
		return SWYM.Resolve(cond).value;
	}
	
	fn.toString = function(){ return "{lambda}" };
	
	return fn;
}

SWYM.NewLambda = function(parsetree, itName)
{
    var declScope = SWYM.scope;
    
	return SWYM.PatternTestFunc(function(params)
	{
        if( !params || params.length < 1 )
        {
            
        }
        else if( params.length > 1 )
        {
            SWYM.LogError(parsetree.pos, "Too many params in function call!");
			return {halt:true};
        }

		var newScope = object(declScope);
		var oldScope = SWYM.scope;
		if ( params && params.length > 0 && params[0] )
		{
			newScope["#default"] = params[0];
			newScope[itName] = params[0]; // n.b. not just .value.
			
			if ( !newScope["this"] )
			{
				newScope["this"] = {value:params[0].value};
			}
		}

		// actually execute the function!
		SWYM.scope = newScope;
		var result = SWYM.ExecDefault(parsetree);
		SWYM.scope = oldScope;
		
		return result;
	});
}

SWYM.selectOverload = function(declName, params, srcpos)
{
	var tooShortForAll = true;
	var tooLongForAll = true;
	var allSameLength = true;
	var numChecked = 0;

	for(var curScope = SWYM.scope; curScope && curScope != Object; curScope = curScope.__proto__ )
	{
		if( !curScope.hasOwnProperty(declName) )
			continue;
		
		overloadList = curScope[declName].value.overloads;
		
		for( var Idx = 0; Idx < overloadList.length; Idx++ )
		{
			var curOverload = overloadList[Idx];
			numChecked++;
			
			if( curOverload.paramTypes.length === params.length )
			{
				tooLongForAll = false;
				tooShortForAll = false;
				
				var matched = true;
				for( var pIdx = 0; pIdx < params.length; pIdx++ )
				{
					if( !SWYM.patternDescribes( curOverload.paramTypes[pIdx], params[pIdx] ) )
					{
						matched = false;
						break;
					}
				}
				
				if( matched )
				{
					return curOverload;
				}
			}
			else
			{
				allSameLength = false;
				if( curOverload.paramTypes.length < params.length )
				{
					tooLongForAll = false;
				}
				else if( curOverload.paramTypes.length < params.length )
				{
					tooShortForAll = false;
				}
			}
		}
	}

	// no backups; report error
	if ( tooLongForAll )
	{
		SWYM.LogError(srcpos, "Too many parameters in call to "+declName+" (got "+params.length+")");
		return undefined;
	}
	else if ( tooShortForAll )
	{
		SWYM.LogError(srcpos, "Not enough parameters in call to "+declName+" (got "+params.length+")");
		return undefined;
	}
	else if ( numChecked === 1 )
	{
		SWYM.LogError(srcpos, "Invalid arguments in call to "+declName);
		return undefined;
	}
	else
	{
		SWYM.LogError(srcpos, "None of the "+numChecked+" overloads matched when calling "+declName);
		return undefined;
	}
}

SWYM.nextReturnToValue = 100;

SWYM.NewMultiFunc = function(declName)
{
    var declScope = SWYM.scope;
    
    var newfn = function(params, srcpos)
    {
		var debugName = declName;
		var overload = SWYM.selectOverload(declName, params, srcpos);
        
        if( !overload )
        {
			return {value:undefined, halt:true};
        }

		// just call a built-in function directly - they can use the calling scope
		// and can return whatever they want
		if( typeof overload.body === "function" )
		{
			return overload.body(params);
		}

		var result;
		var localscope = object(declScope);
		var callerScope = SWYM.scope;
		
		if( params.length > 0 )
		{
			localscope["#default"] = params[0];
		}
		
		for( var Idx = 0; Idx < params.length; Idx++ )
		{
			localscope[overload.paramNames[Idx]] = params[Idx];
		}
		localscope["#ReturnTo"] = SWYM.nextReturnToValue;
		SWYM.nextReturnToValue++;

		if ( !localscope["this"] )
		{
			localscope["this"] = localscope["#default"];
		}

		localscope.Yielded = SWYM.NewArray();
		
		SWYM.scope = localscope;
		var result = SWYM.ExecDefault(overload.body);
		SWYM.scope = callerScope;
		
		if( result && result.halt )
		{
			if( result.returnTo && result.returnTo == localscope["#ReturnTo"] )
			{
				return result.returnResult;
			}
			else
			{
				return result;
			}
		}

		if ( !SWYM.isSwymArray(localscope.Yielded) || SWYM.getArrayLength(localscope.Yielded) > 0 )
		{
			// an explicit Yield overrides the result value
			result = localscope.Yielded;
		}
		else
		{
			// if there's no yield, we auto-resolve the result
			result = SWYM.Resolve(result);
		}
		
		//return SWYM.Resolve(result);
		return result;
    };
    
    newfn.patternTest = function(toTest)
    {
		return newfn([toTest]).value;
    }
    
    newfn.overloads = [];
	newfn.toString = function() { return "{function}"; }
    return newfn;
}

SWYM.patternDescribes = function(pattern,cell)
{
    if ( !pattern || !cell )
    {
        SWYM.LogError(0, "Can't pattern-test a null value!");
        return {value:undefined, halt:true};
    }
    
    if ( pattern.patternTest )
    {
        return pattern.patternTest(cell);
    }
    else
    {
        SWYM.LogError(0, "Value "+pattern+" is not a pattern!");
    }
}

SWYM.NewVar = function(contents, patternTest, patternName)
{
    var cell = {
        value:contents,
        setContents:function(newcell){
            if(!patternTest || patternTest(newcell))
            {
                cell.value = newcell.value;
                return cell;
            }
            else
            {
                SWYM.LogError(0, "Can't store "+newcell+" here: expecting "+patternName);
                return {value:undefined, halt:true};
            }
        },
    };
    return cell;
}

SWYM.isTruthy = function(v) { return v !== undefined && v !== null && v !== false; }

SWYM.pushAll = function(resultSoFar, newResults)
{
    for( var Idx = 0; Idx < newResults.length; Idx++ )
    {
        resultSoFar.push(newResults[Idx]);
    }
}


SWYM.PlusOrMinusExec = function(a,b)
{
    var result = SWYM.NewArray();
	result.push({value:a.value + b.value});
	result.push({value:a.value - b.value});
	return result;
};

SWYM.Resolve = function(multival)
{
	if( SWYM.isSwymArray(multival) )
	{
		var resolve = multival.resolve;
		var fnInputList = null;
		var length = SWYM.getArrayLength(multival)

		if( !resolve )
		{
			if( length === 1 )
				return SWYM.Resolve(SWYM.indexOp(multival, 0));
			else
			{
				return SWYM.MultiExec(multival, function(mn){ return SWYM.Resolve(mn); });
			}
		}

		for (var Idx = 0; Idx < length; Idx++ )
		{
			var element = SWYM.indexOp(multival, Idx);
			if( SWYM.isSwymArray(element) )
			{
				if( !fnInputList )
				{
					fnInputList = SWYM.NewArray();
					for( var FillIdx = 0; FillIdx < Idx; FillIdx++ )
					{
						fnInputList.push(SWYM.indexOp(multival, FillIdx));
					}
				}

				fnInputList.push(SWYM.Resolve(element));
			}
			else if ( fnInputList )
			{
				fnInputList.push(element);
			}
		}

		if( !fnInputList )
			fnInputList = multival;

		return resolve([{value:fnInputList}]);
	}
	else
	{
		return multival;
	}
}

/*	if( params.length !== 1 || !SWYM.isSwymArray(params[0].value) )
	{
		SWYM.LogError(0, "Invalid parameters when resolving Each: "+params);
		return {value:undefined, halt:true};
	}
	
	return {value:SWYM.MultiExec(params[0].value, function(element)
	{
		return element;
	})};
}*/

SWYM.ResolveEvery = function(params)
{
	if( params.length !== 1 || !SWYM.isSwymArray(params[0].value) )
	{
		SWYM.LogError(0, "Invalid parameters when resolving Each: "+params);
		return {value:undefined, halt:true};
	}
	
	return SWYM.MultiExecUntilFirst(params[0].value, function(element)
	{
		if( !element || !SWYM.isTruthy(element.value) )
			return {value:false};
	}, {value:true});
}

SWYM.ResolveSome = function(params)
{
	if( params.length !== 1 || !SWYM.isSwymArray(params[0].value) )
	{
		SWYM.LogError(0, "Invalid parameters when resolving Some: "+params);
		return {value:undefined, halt:true};
	}
	
	return SWYM.MultiExecUntilFirst(params[0].value, function(element)
	{
		if( element && SWYM.isTruthy(element.value) )
			return {value:true};
	}, {value:false});
}

SWYM.isEqual = function(a,b)
{
	if( a === b )
		return true;

	return SWYM.isEqualValue(a.value, b.value);
}

SWYM.isEqualValue = function(a,b)
{
	if( a === b )
		return true;
	
	if( !a || !b ) // any false values that were equal should have been caught above
		return false;
	
	if( SWYM.isSwymString(a) && SWYM.isSwymString(b) )
	{
		return SWYM.getRawString(a) === SWYM.getRawString(b);
	}
	else if( SWYM.isSwymArray(a) && SWYM.isSwymArray(b) )
	{
		var alen = SWYM.getArrayLength(a);
		var blen = SWYM.getArrayLength(b);
		
		if( alen != blen )
			return false;

		for( var Idx = 0; Idx < alen; Idx++ )
		{
			var av = SWYM.indexOp(a, Idx);
			var bv = SWYM.indexOp(b, Idx);
			if( !SWYM.isEqual( av, bv ) )
				return false;
		}
		
		return true;
	}
	
	if( a.swymChar && a.swymChar === b.swymChar )
		return true;
	
	return false;
}

SWYM.assignmentOp = function(a,b, op)
{
	if (a.setContents)
	{
		return a.setContents(b);
	}
	else
	{
		SWYM.LogError(op.pos, "Can't assign "+b+" to non-mutable value "+a);
		return {value:undefined, halt:true};
	}
}

SWYM.AddFunctionWithOverload = function(declName, argTypes, argNames, body)
{
	var mfunc;
	if( SWYM.scope.hasOwnProperty(declName) )
	{
		mfunc = SWYM.scope[declName].value;
		mfunc.isSwymArray = false; // TODO: allow overloaded functions to be enumerated
	}
	else
	{
		mfunc = SWYM.NewMultiFunc(declName);
		SWYM.scope[declName] = {value:mfunc};

		// if the argtype is finite, allow this function to be treated as a list
		if( argTypes.length == 1 && argTypes[0].isSwymArray )
		{
			mfunc.isSwymArray = true;
			var array = SWYM.arrayFilter(argTypes[0], mfunc.patternTest);
			mfunc.getElement = array.getElement;
			mfunc.getLength = array.getLength;
			mfunc.patternTest = SWYM.ArrayContentTester(mfunc);
		}
	}

	mfunc.overloads.push({
		paramTypes:argTypes,
		paramNames:argNames,
		body:body
	});
}

SWYM.declOp = function(parsetree)
{
	if ( !parsetree.children[0] )
	{
		SWYM.LogError(parsetree.op.pos, "Missing left side of declaration'");
		return {value:undefined, halt:true};
	}

	var declName;
	var valueToSet; // the cell we're going to put into the scope

	if ( parsetree.children[0].type === "name" )
	{
		declName = parsetree.children[0].text;

		valueToSet = SWYM.ExecDefault(parsetree.children[1]);
	}
	else if (parsetree.children[0].type === "node" )
	{
		var argTypes = [];
		var argNames = [];
		var declArg = parsetree.children[0];
		if ( declArg.op.functionName )
		{
			declName = declArg.op.functionName;
			SWYM.parseFunctionArguments(declArg.children, argTypes, argNames, declName[1] === "#");
		}
		else if ( declArg.op.text === "is" && declArg.children[1].type === "name" )
		{
			declName = declArg.children[1].text;
			argTypes.push(SWYM.ExecDefault(declArg.children[0]).value);
			argNames.push("it");
		}
		else
		{
			SWYM.LogError(0, "Don't understand "+declArg.op.text+" in a declaration");
			return {halt:true};
		}

		if( parsetree.children[1] && parsetree.children[1].type === "node" &&
			(parsetree.children[1].op.text === "(lambda{})" || parsetree.children[1].op.text === "return" || parsetree.children[1].op.text === "yield" ))
		{
			if( parsetree.children[1].op.text === "(lambda{})" )
				body = parsetree.children[1].children[0];
			else // text === "return" or "yield"
				body = parsetree.children[1];

			// it's a simple function declaration. Handle overloads.
			SWYM.AddFunctionWithOverload(declName, argTypes, argNames, body);
		}
		else
		{
			// a .foo function is being defined as the _result of an expression_.
			// Overloads aren't currently supported for these.
			
			// inject all parameter names into the scope, so the expression will have access to them
			var oldScope = SWYM.scope;
			var newScope = object(oldScope);
			
			for( var Idx = 0; Idx < argNames.length; ++Idx )
			{
				newScope[argNames[Idx]] = {value:"fail!"};
			}
			
			SWYM.scope = newScope;
			var bodyFn = SWYM.ExecDefault(parsetree.children[1]);
			SWYM.scope = oldScope;
			
			if( !bodyFn )
			{
				SWYM.LogError(parsetree.op.pos, "Error evaluating function body for "+declName);
				return {halt:true};
			}
			else if ( bodyFn.halt )
			{
				return bodyFn;
			}
			else if ( !bodyFn.value || typeof bodyFn.value !== "function" )
			{
				SWYM.LogError(parsetree.op.pos, "Cannot declare function "+declName+". Its body \""+bodyFn.value+"\" is not a function!");
				return {halt:true};
			}

			valueToSet = {value:function(params)
			{
				// TODO: type check args
				for( var Idx = 0; Idx < argNames.length; ++Idx )
				{
					newScope[argNames[Idx]] = params[Idx];
				}
				return bodyFn.value([]);
			}};
			
			valueToSet.value.autoresolve = bodyFn.value.autoresolve; // I'm not happy with having to hack this...
			valueToSet.value.toString = function(){return "{expression}"}
		}
	}
	else
	{
		SWYM.LogError(parsetree.op.pos, "Left side of declaration should be either 'bar', 'Foo is bar', or 'Foo.bar' - got: '"+parsetree.children[0]+"'");
		return {value:undefined, halt:true};
	}
		
	var result;
	if ( valueToSet )
	{
		if ( SWYM.scope[declName] )
		{
			SWYM.LogError(parsetree.op.pos, "Can't declare "+declName+" because it already exists!");
			return {value:undefined, halt:true};
		}

		if ( !parsetree.children[1] )
		{
			SWYM.LogError(parsetree.op.pos, "Left side of declaration is neither a name nor a function: '"+parsetree.children[0]+"'");
			return {value:undefined, halt:true};
		}
		
		if ( SWYM.isSwymArray(valueToSet) )
		{
			if( valueToSet.resolve )
			{
				result = SWYM.Resolve(valueToSet);
			}
			else if( SWYM.getArrayLength(valueToSet) === 0 )
			{
				SWYM.LogError(parsetree.op.pos, "Can't assign zero values to "+declName);
				return {halt:true};
			}
			else if ( SWYM.isSwymArray(valueToSet) )
			{
				if ( SWYM.getArrayLength(valueToSet) > 1 )
				{
					SWYM.LogError(parsetree.op.pos, "Can't assign multiple values to "+declName);
					return {halt:true};
				}
				
				result = SWYM.indexOp(valueToSet, 0);
			}
		}
		else
		{
			result = valueToSet;
		}

//		if ( result && result.value && result.value.temporary )
//		{
//			result.value = SWYM.MakeStorable(result.value);
//		}
	
		SWYM.scope[declName] = result;
	}
	return result;
}

SWYM.patternFilter = function(oldPatternTest, newFilter)
{
	return {patternTest:function(cell){
		return oldPatternTest(cell) && newFilter(cell);
	}};
}

/*
SWYM.arrayFilter = function(array, filter)
{
	return SWYM.MultiExec(array, function(element)
	{
		if ( SWYM.isTruthy(filter(element)) )
			return element;
	});
}

*/
// lazy version
SWYM.arrayFilter = function(array, filter)
{
	var result = SWYM.MultiExecLazy(array, function(element)
	{
		var cond = filter(element);
		if ( SWYM.isTruthy(cond) )
			return element;
	});
	
	result.patternTest = function(v){ return filter.patternTest(v) && array.patternTest(v); }
	return result;
}

/*SWYM.PassByValue = function(cell)
{
	if( cell && cell.passByReference )
		return cell.passByReference

	if( cell && cell.setContents )
		return {value:cell.value};

	return cell;
}*/

// SwymArray properties:
//	result.patternTest = SWYM.ArrayContentTester(result);
//	result.isSwymArray = true;
//	result.toString = function(){ return theArray.toString() };
//	result.getLength = function(){ return theArray.length; }
//	result.getElement = function(idx){ return theArray[idx]; }
//	result.push = function(v){ return theArray.push(v); }
//	result.resolve = resolveFn;

SWYM.fnOp = function(functionName, args, srcpos)
{
	var scopeEntry = SWYM.scope[functionName];
	var thefn;
	if ( scopeEntry && scopeEntry.value )
	{
		thefn = scopeEntry.value;
	}

	if (!thefn)
	{
		if( functionName )
			SWYM.LogError(srcpos, "Unknown function "+functionName);
		else
			SWYM.LogError(srcpos, "Expected: function name");
		return {value:undefined, halt:true};
	}

	if ( args.length === 0 || (args.length === 1 && args[0] === undefined) )
	{
		return thefn([], srcpos);
	}

	var paramsResult = [];
	for(var Idx = 0; Idx < args.length; Idx++ )
	{
		var newResult;
		var child = args[Idx];
		
		/*if ( parsetree.etcExpandAround === Idx )
		{
			var etcIndexCell = SWYM.scope["#etcIndex"+parsetree.etcId];
			var oldEtcIndex = etcIndexCell.value;

			etcIndexCell.value--;
			newResult = SWYM.ExecDefault(parsetree);
			etcIndexCell.value = oldEtcIndex;

			if( newResult && newResult.halt )
				return newResult;

			paramsResult.push( SWYM.PassByValue(newResult) );
		}
		else*/
		if( child.op && child.op.text === "(parentheses())" && child.children[0] &&
			child.children[0].op && child.children[0].op.text === "," )
		{
			var processComma = function(comma)
			{
				if( comma && comma.op && comma.op.text === "," )
				{
					return processComma(comma.children[0]) && processComma(comma.children[1]);
				}
				else
				{
					newResult = SWYM.ExecDefault(comma);
					if( newResult && newResult.halt )
						return false;
			
//					if( newResult && newResult.setContents && !newResult.passByReference )
//						newResult = {value:newResult.value};

					paramsResult.push(newResult);// SWYM.PassByValue(newResult) );
					return true;
				}
			};
			if( !processComma(child.children[0]) )
				return {value:undefined, halt:true};
		}
		else
		{
			newResult = SWYM.ExecDefault(child);
			if( newResult && newResult.halt )
				return newResult;

//			if( newResult && newResult.setContents && !newResult.passByReference )
//				newResult = {value:newResult.value};

			paramsResult.push(newResult);// SWYM.PassByValue(newResult) );
		}
	}
	
	// check whether this is just a single-path execution... or if it's an autoresolve
	// function, collapse it down to ensure it's just a single-path execution!
	var allParamsSingular = true;
	for(var Idx = 0; Idx < paramsResult.length; Idx++ )
	{
		if( SWYM.isSwymArray(paramsResult[Idx]) )
		{
			if( thefn.autoresolve )
			{
				if( SWYM.getArrayLength(paramsResult[Idx]) === 1 && !paramsResult[Idx].resolve )
				{
					paramsResult[Idx] = SWYM.indexOp(paramsResult[Idx], 0);
				}

				if ( paramsResult[Idx].resolve )
				{
					paramsResult[Idx] = SWYM.Resolve(paramsResult[Idx]);
				}
				else
				{
					SWYM.LogError(0, "Illegal argument: A function that autoresolves, e.g. 'if', cannot take a multivalue argument.");
					return {halt:true};
				}

				if( paramsResult[Idx].halt )
				{
					return paramsResult[Idx];
				}
				else if ( SWYM.isSwymArray(paramsResult[Idx]) )
				{
					SWYM.LogError(0, "An autoresolve function failed to resolve argument "+Idx+" into a single value");
					return {halt:true};
				}
			}
			else
			{
				allParamsSingular = false;
				break;
			}
		}
	}
	// ok, single path! Just pass the params right in.
	if( allParamsSingular )
		return thefn(paramsResult, srcpos);
		
	// it's multi-path - see if we can do an easy one-arg or two-args case.
	if( paramsResult.length === 1 )
	{
		return SWYM.MultiExec(paramsResult[0], function(arg) { return thefn([arg], srcpos); });
	}
	else if ( paramsResult.length === 2 )
	{
		return SWYM.MultiExec(paramsResult[0], function(arg0){
			return SWYM.MultiExec(paramsResult[1], function(arg1){
				return thefn([arg0, arg1], srcpos);
			});
		});
	}
	
	//fine. Just enumerate all possible combinations of parameters
	var nextParam = 0;
	var curParams = [];
	var paramAccumulate = function(nextP)
	{
		if( nextParam >= paramsResult.length )
		{
			// finally call the function!
			return thefn(curParams, srcpos);
		}

		var oldParams = curParams;

		nextParam++;
		curParams = oldParams.concat([nextP]);

			var result = SWYM.MultiExec(paramsResult[nextParam], paramAccumulate);

		nextParam--;
		curParams = oldParams;
		
		return result;
	};
	
	return SWYM.MultiExec(paramsResult[0], paramAccumulate);
}

SWYM.notOp = function(patternTest)
{
	return {value:{patternTest:function(cell){ return !patternTest(cell); }}};
}

SWYM.CommaOp = function(lv, rv)
{
	var results = SWYM.NewArray();
	
	if( lv )
	{
		if( SWYM.isSwymArray(lv) && !lv.resolve )
			results = lv;
		else
			results.push(lv);
	}
	
	if( rv )
	{
		if( SWYM.getArrayLength(results) == 0 && !results.resolve )
		{
			results = rv;
		}
		else if( SWYM.isSwymArray(rv) && rv.resolve === results.resolve )
		{
			if( SWYM.getArrayLength(results) == 0 )
				results = rv;
			else
				SWYM.MultiExec(rv, function(rvn){ results.push(rvn); });
		}
		else
		{
			results.push(rv);
		}
	}
	
	return results;
}

SWYM.CellIndex = function(cell, context)
{
	if( cell.homeContext === context.value )
		return cell.homeIndex;

	var length = SWYM.getArrayLength(context.value);

	// a smarter compiler could precalculate this
	for (var Idx = 0; Idx < length; Idx++)
	{
		var entry = SWYM.indexOp(context.value, Idx);
		if( entry === cell )
			return Idx;
	}
	
	return undefined;
}

SWYM.RangeOp = function(lval, rval, includeStart, includeEnd, step)
{
	var ltarget = Math.round(Number(lval.value));
	var rtarget = Math.round(Number(rval.value));

	if( step === undefined )
		step = ltarget < rtarget? 1: -1;
								
	if( !includeStart )
		ltarget += step;
	
	if( !includeEnd )
		rtarget -= step;

	var result = SWYM.NewArray();

	for( var Idx = ltarget; Idx*step <= rtarget*step; Idx+=step )
	{
		result.push({value: Idx});
	}

	return result;
}

SWYM.ComparisonOp = function(v, compare)
{
	if( SWYM.isSwymArray(v.value) )
	{
		return {value:SWYM.arrayFilter(v.value, compare)};
	}
	else if( v.value.patternTest )
	{
		return {value:SWYM.patternFilter(v.value.patternTest, compare)};
	}
	else
	{
		return {value:compare(v)};
	}
}

SWYM.sortBy = function(baseList, getv)
{
	var numElements = SWYM.getArrayLength(baseList);
		
	var gotvs = [];
	for( var baseIdx = 0; baseIdx < numElements; baseIdx++ )
	{
		gotvs.push(getv([SWYM.indexOp(baseList, baseIdx)]).value);
	}
	
	var result = SWYM.NewArray();
	while( SWYM.getArrayLength(result) < numElements )
	{
		var best = undefined;
		var bestv = undefined;
		var bestIdx = undefined;
		for( var baseIdx = 0; baseIdx < numElements; baseIdx++ )
		{
			var testv = gotvs[baseIdx];
			if( testv !== undefined )
			{
				if( bestIdx === undefined || testv < bestv )
				{
					bestv = testv;
					bestIdx = baseIdx;
				}
			}
		}

		result.push(SWYM.indexOp(baseList, bestIdx));
		gotvs[bestIdx] = undefined;
	}
	
	return result;
}

SWYM.ClassClass = {};

SWYM.NewClass = function()
{
  var classSignature = {};
  return {value:{
	patternTest:function(cell){ return cell.value.classSignature === classSignature; },
    instantiate:function(params){ return {value:{classSignature:classSignature}}; },
	classSignature:SWYM.ClassClass,
  }};
}