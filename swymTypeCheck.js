SWYM.TypeCoerce = function(typeCheck, valueInfo, errorNode, errorContext)
{
	if( !SWYM.TypeMatches(typeCheck, valueInfo) )
	{
		SWYM.LogError(errorNode, "Type mismatch: expected "+SWYM.TypeToString(typeCheck)+", got "+SWYM.TypeToString(valueInfo));
	}
	
	return valueInfo;
}

SWYM.TypeToString = function(type)
{
	if( type === undefined )
		return "<missing type>"
	else if( type.debugName !== undefined )
		return type.debugName;
	else if ( type.needsCompiling !== undefined )
		return "Block";
	else
		return ""+type;
}

SWYM.IsOfType = function(value, typeCheck, exact, errorContext)
{
	if( typeCheck.baked !== undefined )
	{
		return SWYM.IsEqual(typeCheck.baked, value, exact);
	}
	
	if( value === null )
	{
		return false;
	}
	
	if( typeCheck.memberTypes )
	{
		for( var memberName in typeCheck.memberTypes )
		{
			if( value[memberName] === undefined )
			{
				return false;
			}
			else if( value[memberName] === value && typeCheck.memberTypes[memberName] === typeCheck )
			{
				// handle recursive types - the indices of an IntArray are of type IntArray.
				return true;
			}
			else if( !SWYM.IsOfType(value[memberName], typeCheck.memberTypes[memberName], exact, errorContext) )
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
			case "String":   if(value.type !== "string") return false; break;
			case "JSArray":  if(value.type !== "jsArray") return false; break;
			case "JSObject": if(value.type !== "jsObject") return false; break;
			case "RangeArray":if(value.type !== "rangeArray") return false; break;
			case "Variable": if(value.type !== "variable") return false; break;
			case "Number":   if(typeof value !== "number") return false; break;
			case "JSString": if(typeof value !== "string") return false; break;
			case "Callable":
			{
				if(value.type !== "jsArray" && value.type !== "rangeArray" &&
					value.type !== "lazyArray" &&
					value.type !== "string" && value.type !== "table" &&
					value.type !== "closure" && value.type !== "type")
				{
					return false;
				}
				break;
			}
			case "Struct": if(value.type !== "struct") return false; break;
			case "image": if(value.type !== "image") return false; break;
			default:
			{
				SWYM.LogError(errorContext, "Fsckup: Unrecognized native type '"+typeCheck.nativeType+"'");
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
	
	if( value === null )
	{
		return false;
	}
	
	if( value.type === "jsArray" )
	{		
		if( typeCheck.outType !== undefined )
		{
			for(var Idx = 0; Idx < value.length; ++Idx )
			{
				if( !SWYM.IsOfType(value[Idx], typeCheck.outType, exact, errorContext) )
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

SWYM.TypeMatches = function(typeCheck, valueInfo, exact, errorContext)
{
	// Types are only undefined if there was an error earlier - in which case, we don't care.
	if( !valueInfo || !typeCheck || typeCheck === valueInfo || typeCheck.nativeType === "NoValues" )
	{
		return true;
	}
	
	if( typeCheck.nativeType === "Void" )
	{
		return valueInfo.nativeType === "Void";
	}
	
	if( valueInfo.nativeType === "NoValues" )
	{
		return true;
	}
	
	if( valueInfo.multivalueOf !== undefined )
	{
		if( typeCheck.multivalueOf !== undefined )
		{
			return SWYM.TypeMatches(typeCheck.multivalueOf, valueInfo.multivalueOf, exact);
		}
		else
		{
			return SWYM.TypeMatches(typeCheck, valueInfo.multivalueOf, exact);
		}
	}
	
	if( valueInfo.baked !== undefined )
	{
		return SWYM.IsOfType(valueInfo.baked, typeCheck, exact, errorContext);
	}
	else if( typeCheck.baked !== undefined )
	{
		return false;
	}
	
	if( typeCheck.isMutable && !valueInfo.isMutable )
	{
		return false;
	}
	
	if( typeCheck.nativeType === "Callable" )
	{
		if( valueInfo.needsCompiling === undefined && valueInfo.outType === undefined )
		{
			return false;
		}
	}
	else if( typeCheck.nativeType !== undefined && typeCheck.nativeType !== valueInfo.nativeType )
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
		if( !SWYM.TypeMatches(typeCheck.outType, valueInfo.outType, exact) )
		{
			return false;
		}
	}

	if( typeCheck.argType )
	{
		// NB, backwards! We're checking that the value can accept all values the typeCheck declares. (covariant)
		if( !SWYM.TypeMatches(valueInfo.argType, typeCheck.argType, exact) )
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
			
			if( !SWYM.TypeMatches(typeCheck.memberTypes[memberName], valueInfo.memberTypes[memberName], exact) )
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

SWYM.TypeIntersect = function(typeA, typeB, errorContext)
{
	if( typeA === typeB )
	{
		return typeA;
	}
	else if( typeA === SWYM.DontCareType )
	{
		return typeB;
	}
	else if( typeB === SWYM.DontCareType )
	{
		return typeA;
	}
	
	if( (typeA.multivalueOf !== undefined) !== (typeB.multivalueOf !== undefined) )
	{
		SWYM.LogError(errorContext, "Fsckup: cannot intersect a multivalue with a non multivalue!");
		return undefined;
	}

	if( typeA.multivalueOf !== undefined )
	{
		return SWYM.ToMultivalueType(SWYM.TypeIntersect(typeA.multivalueOf, typeB.multivalueOf, errorContext));
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
		return SWYM.DontCareType;
	}
	
	if( typeA.nativeType !== typeB.nativeType )
	{
		return SWYM.VoidType;
	}

	// TODO: better type intersection
	return typeB;
}

SWYM.TypeUnify = function(typeA, typeB, errorContext)
{
	if ( typeA === typeB )
	{
		return typeA;
	}

	if( (typeA !== undefined && typeA.multivalueOf !== undefined) !== (typeB !== undefined && typeB.multivalueOf !== undefined) )
	{
		SWYM.LogError(errorContext, "Fsckup: cannot unify types with inconsistent multivaluedness");
		return undefined;
	}
	
	if( SWYM.TypeMatches(SWYM.VoidType, typeA) !== SWYM.TypeMatches(SWYM.VoidType, typeB) )
	{
		return SWYM.VoidType;
	}

	if( !typeA || typeA.nativeType === "NoValues" )
	{
		return typeB;
	}
	else if( !typeB || typeB.nativeType === "NoValues" )
	{
		return typeA;
	}

	if( SWYM.TypeMatches(typeA, typeB) )
	{
		return typeA;
	}
	else if( SWYM.TypeMatches(typeB, typeA) )
	{
		return typeB;
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

	if ( typeA.contentType || typeB.contentType )
	{
		result.contentType = SWYM.TypeUnify(typeA.contentType, typeB.contentType);
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
	
	if( (typeA.baked !== undefined || typeA.enumValues !== undefined) &&
			(typeB.baked !== undefined || typeB.enumValues !== undefined) )
	{
		var enumValues = [];
		if( typeA.baked !== undefined )
		{
			enumValues.push(typeA.baked);
		}
		else
		{
			SWYM.pushEach(typeA.enumValues, enumValues);
		}

		if( typeB.baked !== undefined )
		{
			enumValues.push(typeB.baked);
		}
		else
		{
			SWYM.pushEach(typeB.enumValues, enumValues);
		}
		
		enumValues = SWYM.Distinct( SWYM.jsArray(enumValues) );
		
		if( enumValues.length === 1 )
		{
			result.baked = enumValues[0];
			result.debugName = "Literal("+SWYM.ToDebugString(result.baked)+")";
		}
		else
		{
			result.enumValues = enumValues;
			result.debugName = "AnyOf"+SWYM.ToDebugString(result.enumValues);
		}
	}		
		
	if( toCompile !== undefined )
	{
		result.needsCompiling = toCompile;
	}
		
	return result;
}

SWYM.LazyArrayTypeContaining = function(elementType)
{
	var result = SWYM.ArrayTypeContaining(elementType);
	result.isLazy = true;
	result.debugName = "Lazy("+result.debugName+")";
	return result;
}

SWYM.ArrayTypeContaining = function(elementType, isMutable, errorContext)
{
	if( !elementType )
	{
		SWYM.LogError(errorContext, "ArrayTypeContaining - Expected an element type, got: "+elementType);
		return SWYM.ArrayType;
	}

	var outType = SWYM.ToSinglevalueType(elementType);
	var resultType =
	{
		type:"type",
		isMutable:isMutable,
		memberTypes:{length:SWYM.IntType, keys:SWYM.IntArrayType},
		argType:SWYM.IntType,
		outType:outType,
		debugName:"Array("+SWYM.TypeToString(outType)+")"
	};
	
	if( elementType.multivalueOf !== undefined )
	{
		if( elementType.isLazy )
		{
			return SWYM.LazyArrayTypeContaining(outType);
		}
		else
		{
			resultType.baked = elementType.baked;
		}
		
		if( elementType.nativeType !== undefined )
		{
			resultType.nativeType = elementType.nativeType;
		}
	}
	else if( elementType.baked )
	{
		resultType.baked = SWYM.jsArray([elementType.baked]);
	}
	
	return resultType;
}

SWYM.ArrayToMultivalueType = function(arrayType, quantifier)
{
	if( arrayType && arrayType.isLazy )
	{
		var result = SWYM.ToMultivalueType(SWYM.GetOutType(arrayType), quantifier, arrayType.isMutable);
		result.isLazy = true;
		return result;
	}
	else
	{
		return SWYM.ToMultivalueType(SWYM.GetOutType(arrayType), quantifier, arrayType? arrayType.isMutable: undefined);
	}
}

SWYM.TableTypeFromTo = function(keyType, valueType, accessors)
{
	return {type:"type", memberTypes:{keys:SWYM.ArrayTypeContaining(keyType)}, argType:SWYM.ValueType, outType:valueType, debugName:"Table("+SWYM.TypeToString(keyType)+"->"+SWYM.TypeToString(valueType)+")"};
}

SWYM.BakedValue = function(value, errorContext)
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
		if( value.length === 0 )
		{
			result.outType = SWYM.DontCareType;
		}
	}
	else if( value.type === "rangeArray" )
	{
		result = object(SWYM.RangeArrayType);
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
		SWYM.LogError(errorContext, "Fsckup: Unrecognized value '"+SWYM.ToDebugString(value)+"' passed to BakedValue");
		result = {type:"type"};
	}

	result.baked = value;
	result.debugName = "Literal("+SWYM.ToDebugString(value)+")";
	return result;
}

SWYM.GetOutType = function(callableType, argType, errorContext)
{
	var isMultivalue = false;
	var quantifier = undefined;
	if( callableType && callableType.multivalueOf !== undefined )
	{
		isMultivalue = true;
		quantifier = callableType.quantifier;
		callableType = callableType.multivalueOf;
	}
	
	if( !callableType )
	{
		SWYM.LogError(errorContext, "GetOutType - Expected a callable, got: "+callableType);
		return SWYM.DontCareType;
	}
	
	if( callableType === SWYM.DontCareType )
	{
		return SWYM.DontCareType;
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
		SWYM.LogError(errorContext, "Fsckup: OutType of callable "+SWYM.TypeToString(callableType)+" is missing. (failed to compile?)");
		return SWYM.DontCareType;
	}
	
	if( callableType.argType )
	{
		SWYM.TypeCoerce(callableType.argType, argType, errorContext, "Argument to 'do'("+SWYM.TypeToString(callableType)+")");
	}

	if( isMultivalue )
	{
		return SWYM.ToMultivalueType(callableType.outType, quantifier);
	}
	else
	{
		return callableType.outType;
	}
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

SWYM.GetFunctionReturnType = function(argTypes, argNames, theFunction, errorContext)
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
				SWYM.LogError(errorContext, "Invalid type for argument \""+argNames[Idx]+"\". (Expected "+expectedArg.typeCheck.debugName+", got "+argType.debugName+")");
				return undefined;
			}
		}
	}

	if( isMulti )
		return SWYM.ToMultivalueType(theFunction.returnType);
	else
		return theFunction.returnType;
}

SWYM.ToLazyMultivalueType = function(type)
{
	var result = SWYM.ToMultivalueType(SWYM.ToSinglevalueType(type))
	result.isLazy = true;
	return result;
}

SWYM.ToMultivalueType = function(type, quantifier, isMutable)
{
	if( type && type.multivalueOf !== undefined )
	{
/*		if( type.quantifier === undefined && quantifier === undefined )
		{
			// a multi-multivalue is the same as a multivalue
			return type;
		}
		else
		{
*/			quantifier_A = quantifier;
			quantifier_B = type.quantifier;
			if( quantifier_A === undefined )
				quantifier_A = ["EACH"];
			if( quantifier_B === undefined )
				quantifier_B = ["EACH"];
			
			return {type:"type", multivalueOf:type.multivalueOf, isMutable:isMutable, quantifier:quantifier_A.concat(quantifier_B), debugName:type.debugName};
//		}
	}
	else
	{
		return {type:"type", multivalueOf:type, isMutable:isMutable, quantifier:quantifier, debugName:SWYM.TypeToString(type)+"*"};
	}
}

SWYM.ToSinglevalueType = function(type)
{
	if( type === undefined || type.multivalueOf === undefined )
		return type;
		
	return type.multivalueOf;
}

SWYM.VariableTypeContaining = function(contentType, errorContext)
{
	if( !contentType )
	{
		SWYM.LogError(errorContext, "VariableTypeContaining - Expected a content type, got: "+SWYM.TypeToString(contentType));
		return SWYM.DontCareType;
	}

	return {type:"type", nativeType:"Variable", contentType:contentType, debugName:"Var("+contentType.debugName+")"};
}

SWYM.GetVariableTypeContents = function(variableType, errorContext)
{
	if( variableType && variableType.contentType )
	{
		return variableType.contentType;
	}
	else
	{
		SWYM.LogError(errorContext, "Fsckup: GetVariableTypeContents - Expected a variable type, got: "+SWYM.TypeToString(variableType));
		return SWYM.DontCareType;
	}
}