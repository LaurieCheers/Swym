SWYM.TypeCoerce = function(typeCheck, valueInfo, errorContext)
{
	if( !SWYM.TypeMatches(typeCheck, valueInfo) )
	{
		SWYM.LogError(0, "Type mismatch: expected "+SWYM.TypeToString(typeCheck)+", got "+SWYM.TypeToString(valueInfo)+". Context: "+errorContext);
	}
	
	return valueInfo;
}

SWYM.TypeToString = function(type)
{
	if( type !== undefined )
		return type.debugName;
	else
		return ""+type;
}

SWYM.IsOfType = function(value, typeCheck)
{
	if( typeCheck.baked !== undefined )
	{
		return SWYM.IsEqual(typeCheck.baked, value);
	}
	
	if( typeCheck.memberTypes )
	{
		for( var memberName in typeCheck.memberTypes )
		{
			if( value[memberName] === undefined || !SWYM.IsOfType(value[memberName], typeCheck.memberTypes[memberName]) )
			{
				return false;
			}
		}
	}

	if( typeCheck.nativeType !== undefined )
	{
		switch(typeCheck.nativeType)
		{
			case "Void": return false;
			case "NoValues": return true; break;
			case "Type":     if(value.type !== "type") return false; break;
			case "Number":   if(typeof value !== "number") return false; break;
			case "String":   if(typeof value !== "string") return false; break;
			case "JSArray":  if(value.type !== "jsArray") return false; break;
			case "JSObject": if(value.type !== "jsObject") return false; break;
			case "Variable": if(value.type !== "variable") return false; break;
			case "Struct": if(value.type !== "struct") return false; break;
			default:
			{
				SWYM.LogError(0, "Fsckup: Unrecognized native type '"+typeCheck.nativeType+"'");
				return true;
			}
		}
		
		if( typeCheck.nativeType === "Number" )
		{
			if( typeCheck.multipleOf !== undefined && (value % typeCheck.multipleOf) !== 0 )
			{
				return false;
			}

			if( typeCheck.greaterThan !== undefined && value <= typeCheck.greaterThan )
			{
				return false;
			}
			
			if( typeCheck.greaterThanEq !== undefined && value < typeCheck.greaterThanEq )
			{
				return false;
			}

			if( typeCheck.lessThan !== undefined && value >= typeCheck.lessThan )
			{
				return false;
			}

			if( typeCheck.lessThanEq !== undefined && value > typeCheck.lessThanEq )
			{
				return false;
			}
		}
	}
	
	if( value.type === "jsArray" )
	{		
		if( typeCheck.outType !== undefined )
		{
			for(var Idx = 0; Idx < value.length; ++Idx )
			{
				if( !SWYM.IsOfType(value[Idx], typeCheck.outType) )
				{
					return false;
				}
			}
		}
	}
	
	if( typeCheck.enumValues !== undefined )
	{
		for( var Idx = 0; Idx < typeCheck.enumValues.length; ++Idx )
		{
			if( SWYM.IsEqual(value, typeCheck.enumValues[Idx]) )
			{
				return true;
			}
		}
		
		return false;
	}
	
	return true;
}

SWYM.TypeMatches = function(typeCheck, valueInfo)
{
	// Types are only undefined if there was an error earlier - in which case, we don't care.
	if( !valueInfo || !typeCheck || typeCheck === valueInfo || valueInfo.nativeType === "NoValues" )
	{
		return true;
	}
	
	if( valueInfo.multivalueOf !== undefined )
	{
		if( typeCheck.multivalueOf !== undefined )
		{
			return SWYM.TypeMatches(typeCheck.multivalueOf, valueInfo.multivalueOf);
		}
		else
		{
			return SWYM.TypeMatches(typeCheck, valueInfo.multivalueOf);
		}
	}
	
	if( valueInfo.baked !== undefined )
	{
		return SWYM.IsOfType(valueInfo.baked, typeCheck);
	}
	else if( typeCheck.baked !== undefined )
	{
		return false;
	}
		
	if( typeCheck.nativeType !== undefined && typeCheck.nativeType !== valueInfo.nativeType )
	{
		return false;
	}
	
	if( typeCheck.nativeType === "Number" )
	{
		if( typeCheck.multipleOf !== undefined &&
			(valueInfo.multipleOf === undefined || (valueInfo.multipleOf % typeCheck.multipleOf) !== 0 ) )
		{
			return false;
		}

		if( typeCheck.greaterThan !== undefined )
		{
			if( (valueInfo.greaterThan === undefined || valueInfo.greaterThan < typeCheck.greaterThan) &&
				(valueInfo.greaterThanEq === undefined || valueInfo.greaterThanEq <= typeCheck.greaterThan) )
			{
				return false;
			}
		}
		else if( typeCheck.greaterThanEq !== undefined )
		{
			// some would say this first condition is a tiny bit too strict (it rejects
			// valueInfo.greaterThan = typeCheck.greaterThanEq - epsilon, where epsilon
			// is the double precision threshold). Swym doesn't care about the technicalities
			// of double precision numbers.
			if( (valueInfo.greaterThan === undefined || valueInfo.greaterThan < typeCheck.greaterThanEq) &&
				(valueInfo.greaterThanEq === undefined || valueInfo.greaterThanEq < typeCheck.greaterThanEq) )
			{
				return false;
			}
		}

		if( typeCheck.lessThan !== undefined )
		{
			if( (valueInfo.lessThan === undefined || valueInfo.lessThan > typeCheck.lessThan) &&
				(valueInfo.lessThanEq === undefined || valueInfo.lessThanEq >= typeCheck.lessThan) )
			{
				return false;
			}
		}
		else if( typeCheck.lessThanEq !== undefined )
		{
			if( (valueInfo.lessThan === undefined || valueInfo.lessThan > typeCheck.lessThanEq) &&
				(valueInfo.lessThanEq === undefined || valueInfo.lessThanEq > typeCheck.lessThanEq) )
			{
				return false;
			}
		}
	}
	
	if( typeCheck.outType )
	{
		//TODO: take the typeCheck.argType into account when determining valueInfo.outType.
		if( !SWYM.TypeMatches(typeCheck.outType, valueInfo.outType) )
		{
			return false;
		}
	}

	if( typeCheck.argType )
	{
		// NB, backwards! We're checking that the value can accept all values the typeCheck declares. (covariant)
		if( !SWYM.TypeMatches(valueInfo.argType, typeCheck.argType) )
		{
			return false;
		}
	}
	
	if( typeCheck.memberTypes )
	{
		if( !valueInfo.memberTypes )
		{
			return false;
		}
		
		for( var memberName in typeCheck.memberTypes )
		{
			if( valueInfo.memberTypes[memberName] === undefined )
			{
				return false;
			}
			
			if( !SWYM.TypeMatches(typeCheck.memberTypes[memberName], valueInfo.memberTypes[memberName]) )
			{
				return false;
			}
		}
	}
	
	if( typeCheck.enumValues )
	{
		// "baked" was already handled above
		if( valueInfo.enumValues === undefined )
		{
			return false;
		}
		
		if( valueInfo.enumValues !== typeCheck.enumValues )
		{
			for( var Idx = 0; Idx < valueInfo.enumValues.length; ++Idx )
			{
				if( !SWYM.ArrayContains(typeCheck.enumValues, valueInfo.enumValues.run(Idx)) )
				{
					return false;
				}
			}
		}
	}

	return true;
}

SWYM.TypeIntersect = function(typeA, typeB)
{
	if( typeA === typeB )
	{
		return typeA;
	}
	
	if( (typeA.multivalueOf !== undefined) !== (typeB.multivalueOf !== undefined) )
	{
		SWYM.LogError(0, "Fsckup: cannot intersect a multivalue with a non multivalue!");
		return undefined;
	}

	if( typeA.multivalueOf !== undefined )
	{
		return SWYM.ToMultivalueType(SWYM.TypeIntersect(typeA.multivalueOf, typeB.multivalueOf));
	}
	
	if( SWYM.TypeMatches(typeA, typeB) )
	{
		return typeB;
	}
	else if( SWYM.TypeMatches(typeB, typeA) )
	{
		return typeA;
	}

	// if one or both types is baked, but the above check didn't early out, then they're disjoint.
	if( typeA.baked !== undefined || typeB !== undefined )
	{
		return SWYM.NoValuesType;
	}
	
	if( typeA.nativeType !== typeB.nativeType )
	{
		return SWYM.VoidType;
	}

	// TODO: better type intersection
	return typeB;
}

SWYM.TypeUnify = function(typeA, typeB)
{
	if ( typeA === typeB )
	{
		return typeA;
	}

	if( (typeA !== undefined && typeA.multivalueOf !== undefined) !== (typeB !== undefined && typeB.multivalueOf !== undefined) )
	{
		SWYM.LogError(0, "Fsckup: cannot unify types with inconsistent multivaluedness");
		return undefined;
	}

	if( !typeA || typeA.nativeType === "NoValues" )
	{
		return typeB;
	}
	else if( !typeB || typeB.nativeType === "NoValues" )
	{
		return typeA;
	}
	
	if( typeA.multivalueOf )
	{
		return SWYM.ToMultivalueType(SWYM.TypeUnify(typeA.multivalueOf, typeB.multivalueOf));
	}
	
	var toCompile = undefined;
	
	if( typeA.needsCompiling || typeB.needsCompiling )
	{
		var toCompile = [];
		if( typeA.needsCompiling )
		{
			SWYM.pushEach(typeA.needsCompiling, toCompile);
		}
		if( typeB.needsCompiling )
		{
			SWYM.pushEach(typeB.needsCompiling, toCompile);
		}
	}

	var result = {type:"type", debugName:typeA.debugName+"|"+typeB.debugName};
	
	if( typeA.nativeType !== undefined && typeA.nativeType === typeB.nativeType )
	{
		result.nativeType = typeA.nativeType;
		
		if( typeA.multipleOf !== undefined && typeB.multipleOf !== undefined )
		{
			if( (typeB.multipleOf % typeA.multipleOf) === 0 )
			{
				result.multipleOf = typeB.multipleOf;
			}
			else if( (typeA.multipleOf % typeB.multipleOf) === 0 )
			{
				result.multipleOf = typeA.multipleOf;
			}
			else if( typeA.multipleOf % 1 == 0 && typeB.multipleOf % 1 == 0 )
			{
				// TODO: calculate their greatest common divisor instead of just using 1.
				result.multipleOf = 1;
			}
		}
		
		if( (typeA.greaterThan !== undefined || typeA.greaterThanEq !== undefined) &&
			(typeB.greaterThan !== undefined || typeB.greaterThanEq !== undefined) )
		{
			var lowestValue = typeA.greaterThanEq;
			var mayEq = true;
			
			if( lowestValue === undefined )
			{
				lowestValue = typeA.greaterThan;
				mayEq = false;
			}
			
			if( typeB.greaterThanEq !== undefined && typeB.greaterThanEq <= lowestValue )
			{
				lowestValue = typeB.greaterThanEq;
				mayEq = true;
			}

			if( typeB.greaterThan !== undefined && typeB.greaterThan < lowestValue )
			{
				lowestValue = typeB.greaterThan;
				mayEq = false;
			}
		}

		if( (typeA.lessThan !== undefined || typeA.lessThanEq !== undefined) &&
			(typeB.lessThan !== undefined || typeB.lessThanEq !== undefined) )
		{
			var lowestValue = typeA.lessThanEq;
			var mayEq = true;
			
			if( lowestValue === undefined )
			{
				lowestValue = typeA.lessThan;
				mayEq = false;
			}
			
			if( typeB.lessThanEq !== undefined && typeB.lessThanEq <= lowestValue )
			{
				lowestValue = typeB.lessThanEq;
				mayEq = true;
			}

			if( typeB.lessThan !== undefined && typeB.lessThan < lowestValue )
			{
				lowestValue = typeB.lessThan;
				mayEq = false;
			}
		}
	}

	if ( typeA.outType || typeB.outType )
	{
		result.outType = SWYM.TypeUnify(typeA.outType, typeB.outType);
	}

	//TODO: unifying argtypes is not really this simple.
	if ( typeA.argType || typeB.argType )
	{
		result.argType = SWYM.TypeUnify(typeA.argType, typeB.argType);
	}
	
	if( typeA.memberTypes && typeB.memberTypes )
	{
		var newMemberTypes = {};
		for( var memberName in typeA.memberTypes )
		{
			if( typeB.memberTypes[memberName] !== undefined  )
			{
				newMemberTypes[memberName] = SWYM.TypeUnify(typeA.memberTypes[memberName], typeB.memberTypes[memberName]);
				foundAny = true;
			}
			else
			{
				newMemberTypes[memberName] = SWYM.TypeUnify(typeA.memberTypes[memberName], SWYM.VoidType);
				foundAny = true;
			}
		}
		
		for( var memberName in typeB.memberTypes )
		{
			if( typeA.memberTypes[memberName] === undefined  )
			{
				newMemberTypes[memberName] = SWYM.TypeUnify(typeB.memberTypes[memberName], SWYM.VoidType);
			}
		}
		
		result.memberTypes = newMemberTypes;
	}
	
	if( typeA.baked && typeB.baked && SWYM.IsEqual(typeA.baked, typeB.baked) )
	{
		result.baked = typeA.baked;
	}
		
	if( toCompile !== undefined )
	{
		result.needsCompiling = toCompile;
	}
		
	return result;
}

SWYM.ArrayTypeContaining = function(elementType)
{
	if( !elementType )
	{
		SWYM.LogError(0, "ArrayTypeContaining - Expected an element type, got: "+elementType);
		return SWYM.ArrayType;
	}
	
	var outType = SWYM.ToSinglevalueType(elementType);
	return {type:"type", nativeType:"JSArray", memberTypes:{length:SWYM.IntType}, argType:SWYM.IntType, outType:outType, debugName:SWYM.TypeToString(outType)+".Array"};
}

SWYM.TableTypeFromTo = function(keyType, valueType)
{
	return {type:"type", memberTypes:{keys:SWYM.ArrayTypeContaining(keyType)}, argType:SWYM.ValueType, outType:valueType, debugName:"Table("+SWYM.TypeToString(keyType)+"->"+SWYM.TypeToString(valueType)+")"};
}

SWYM.BakedValue = function(value)
{
	var t = typeof value;
	var result;
	if( value === null )
	{
		return SWYM.VoidType;
	}
	else if( t === "number" )
	{
		if( value % 1 == 0 )
			result = object(SWYM.IntType);
		else
			result = object(SWYM.NumberType);
	}
	else if( t === "boolean" )
	{
		result = object(SWYM.BoolType);
	}
	else if( value.type === "string" )
	{
		result = object(SWYM.StringType);
		result.memberTypes = object(result.memberTypes);
		result.memberTypes.length = SWYM.BakedValue(value.length);
	}
	else if( value.type === "jsArray" )
	{
		result = object(SWYM.ArrayType);
		result.memberTypes = object(result.memberTypes);
		result.memberTypes.length = SWYM.BakedValue(value.length);
	}
	else if( value.type === "type" )
	{
		result = object(SWYM.TypeType);
	}
	else if( value.type === "novalues" )
	{
		result = object(SWYM.NoValues);
	}
	else
	{
		SWYM.LogError(0, "Fsckup: Unrecognized value '"+SWYM.ToDebugString(value)+"' passed to BakedValue");
		result = {type:"type"};
	}

	result.baked = value;
	result.debugName = SWYM.ToDebugString(value);
	return result;
}

SWYM.GetOutType = function(callableType, argType)
{
	if( !callableType )
	{
		SWYM.LogError(0, "GetOutType - Expected a callable, got: "+callableType);
		return SWYM.NoValuesType;
	}
	
	if( callableType === SWYM.NoValuesType )
	{
    return SWYM.NoValuesType;
	}
	
	if( callableType.needsCompiling )
	{
		// this lambda function hasn't been compiled yet!
		var toCompile = callableType.needsCompiling;
		callableType.needsCompiling = undefined;
		
		var compiledType;
		if( toCompile.length > 0 )
		{
			compiledType = SWYM.CompileLambdaInternal(toCompile[0], argType);

			for( var Idx = 1; Idx < toCompile.length; ++Idx )
			{
				compiledType = SWYM.TypeUnify(compiledType, SWYM.CompileLambdaInternal(toCompile[Idx], argType));
			}
		}
		
		if( compiledType.outType !== undefined )
			callableType.outType = compiledType.outType;
		
		if( compiledType.argType !== undefined )
			callableType.argType = compiledType.argType;
		
		if( compiledType.baked !== undefined )
			callableType.baked = compiledType.baked;
	}
	
	if( !callableType.outType )
	{
		SWYM.LogError(0, "Fsckup: OutType of callable "+SWYM.TypeToString(callableType)+" is missing. (failed to compile?)");
		return SWYM.NoValuesType;
	}
	
	if( callableType.argType )
	{
		SWYM.TypeCoerce(callableType.argType, argType, "Argument to 'do'("+SWYM.TypeToString(callableType)+")");
	}

	return callableType.outType;
}

SWYM.FindArgByFinalName = function(expectedArgs, name)
{
	for( var ExName in expectedArgs )
	{
		var expectedArg = expectedArgs[ExName];
		if( expectedArg.finalName === name || expectedArg.index === name )
		{
			return expectedArg;
		}	
	}
}

SWYM.GetFunctionReturnType = function(argTypes, argNames, theFunction)
{
	var isMulti = false;
	for( var Idx = 0; Idx < argTypes.length; Idx++ )
	{
		var argType = argTypes[Idx];

		if( argType && argTypes[Idx].multivalueOf )
			isMulti = true;

		var expectedArg = SWYM.FindArgByFinalName( theFunction.expectedArgs, argNames[Idx] );
		
		if( expectedArg && expectedArg.typeCheck )
		{
			if( !SWYM.TypeMatches(expectedArg.typeCheck, argType) )
			{
				SWYM.LogError(0, "Invalid type for argument \""+argNames[Idx]+"\". (Expected "+expectedArg.typeCheck.debugName+", got "+argType.debugName+")");
				return undefined;
			}
		}
	}

	if( isMulti )
		return SWYM.ToMultivalueType(theFunction.returnType);
	else
		return theFunction.returnType;
}

SWYM.ToMultivalueType = function(type)
{
	if( type && type.multivalueOf !== undefined )
	{
		// a two-level multivalue is the same as one-level
		return type;
	}
	else
	{
		return {type:"type", multivalueOf:type, debugName:SWYM.TypeToString(type)+"*"};
	}
}

SWYM.ToSinglevalueType = function(type)
{
	if( type === undefined || type.multivalueOf === undefined )
		return type;
	
	return type.multivalueOf;
}

SWYM.VariableTypeContaining = function(contentType)
{
	if( !contentType )
	{
		SWYM.LogError(0, "VariableTypeContaining - Expected a content type, got: "+SWYM.TypeToString(contentType));
		return SWYM.NoValuesType;
	}

	return {type:"type", nativeType:"Variable", contentType:contentType, debugName:contentType.debugName+".Var"};
}

SWYM.GetVariableTypeContents = function(variableType)
{
	if( variableType && variableType.contentType )
	{
		return variableType.contentType;
	}
	else
	{
		SWYM.LogError(0, "Fsckup: GetVariableTypeContents - Expected a variable type, got: "+SWYM.TypeToString(variableType));
		return SWYM.NoValuesType;
	}
}