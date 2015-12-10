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
			case "Closure": if(typeof value !== "closure") return false; break;
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
			
			if( value === Infinity || value === -Infinity )
			{
				if( typeCheck.forbidInfinity )
				{
					return false;
				}
			}
			else if( typeCheck.multipleOf !== undefined && (value % typeCheck.multipleOf) !== 0 )
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
	
	if( valueInfo.needsCompiling && typeCheck.needsCompiling )
	{
		return false; // because they're not the same value (see above.)
	}
	
	if( typeCheck.nativeType === "Void" )
	{
		return valueInfo.nativeType === "Void";
	}
	
	if( valueInfo.nativeType === "NoValues" )
	{
		return true;
	}
	
	if( typeCheck.requireSomeBool && !SWYM.IsOfType(false, valueInfo) && !SWYM.IsOfType(true, valueInfo) )
	{
		return false;
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
		if( !SWYM.IsOfType(valueInfo.baked, typeCheck, exact, errorContext) )
		{
			return false;
		}
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
		if( !valueInfo.needsCompiling && valueInfo.outType === undefined )
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
	
	if( typeCheck.outType && typeCheck.outType !== SWYM.AnythingType && typeCheck.outType !== SWYM.DontCareType )
	{
		//TODO: take the typeCheck.argType into account when determining valueInfo.outType.
		if( valueInfo.outType === undefined || !SWYM.TypeMatches(typeCheck.outType, valueInfo.outType, exact) )
		{
			if( !valueInfo.needsCompiling || !SWYM.TypeMatches(typeCheck.outType, SWYM.GetOutType(valueInfo, typeCheck.argType), exact) )
			{
				return false;
			}
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
	
	if( typeA === undefined )
	{
		return typeB;
	}
	else if( typeB === undefined )
	{
		return typeA;
	}
	
/*	if( typeA.needsCompiling || typeB.needsCompiling )
	{
		SWYM.LogError(errorContext, "If a block can't be resolved until runtime, provide an explicit argument type for it by calling ArgType.block{...}.");
		return typeA;
	}*/

	if( typeA.multivalueOf !== undefined && typeB.multivalueOf !== undefined )
	{
		return SWYM.ToMultivalueType(SWYM.TypeUnify(typeA.multivalueOf, typeB.multivalueOf, errorContext));
	}
	
	if( typeA.multivalueOf !== undefined || typeB.multivalueOf !== undefined )
	{
		SWYM.LogError(errorContext, "Fsckup: cannot unify types with inconsistent multivaluedness");
		return undefined;
	}
	
	if( SWYM.TypeMatches(SWYM.VoidType, typeA) !== SWYM.TypeMatches(SWYM.VoidType, typeB) )
	{
		return SWYM.VoidType;
	}

	if( typeA.nativeType === "NoValues" )
	{
		return typeB;
	}
	else if( typeB.nativeType === "NoValues" )
	{
		return typeA;
	}
	
	// I've made peace with this special case - a StringChar unified with a String(1)
	// yields a StringChar.
	// In other words, a string literal of length 1 acts like either a StringChar, or a String(1),
	// as circumstances dictate. If you put it with StringChars, it will act like a StringChar.
	if( (SWYM.TypeMatches(SWYM.StringCharType, typeA) && SWYM.TypeMatches(SWYM.String1Type, typeB)) ||
		(SWYM.TypeMatches(SWYM.StringCharType, typeB) && SWYM.TypeMatches(SWYM.String1Type, typeA)) )
	{
		return SWYM.StringCharType;
	}

	if( SWYM.TypeMatches(typeA, typeB) )
	{
		return typeA;
	}
	else if( SWYM.TypeMatches(typeB, typeA) )
	{
		return typeB;
	}

	if( typeA.tupleTypes !== undefined || typeB.tupleTypes !== undefined )
	{
		var elementType = SWYM.TypeUnify(
			SWYM.GetOutType(typeA, SWYM.IntType, errorContext),
			SWYM.GetOutType(typeB, SWYM.IntType, errorContext),
			errorContext
		);
		
		if( typeA.tupleTypes !== undefined &&
			typeB.tupleTypes !== undefined &&
			typeA.tupleTypes.length === typeB.tupleTypes.length )
		{
			var newTupleTypes = new Array(typeA.tupleTypes.length);
			for( var Idx = 0; Idx < typeA.tupleTypes.length; ++Idx )
			{
				newTupleTypes[Idx] = SWYM.TypeUnify( typeA.tupleTypes[Idx], typeB.tupleTypes[Idx], errorContext );
			}
			
			return SWYM.TupleTypeOf(newTupleTypes, elementType, errorContext);
		}
		else
		{
			// only one is a tuple, or they are different lengths
			return SWYM.ArrayTypeContaining(elementType);
		}
	}
	
	if( typeA.baked !== undefined || typeB.baked !== undefined )
	{
		if( SWYM.IsEqual(typeA.baked, typeB.baked) )
		{
			return typeA;
		}

		// throw away the baked information, find a common type between the two
		var strippedTypeA = SWYM.StripBakedInformation( typeA, errorContext );
		var strippedTypeB = SWYM.StripBakedInformation( typeB, errorContext );
		
		return SWYM.TypeUnify(strippedTypeA, strippedTypeB, errorContext);
	}
	
	if( typeA.multivalueOf )
	{
		return SWYM.ToMultivalueType(SWYM.TypeUnify(typeA.multivalueOf, typeB.multivalueOf, errorContext));
	}
	
	var toCompile = undefined;
	
	if( typeA.needsCompiling || typeB.needsCompiling )
	{
		toCompile = [];
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
		
		if( typeA.isStringChar && typeB.isStringChar )
		{
			result.isStringChar = true;
		}
	}

	if ( typeA.outType || typeB.outType )
	{
		result.outType = SWYM.TypeUnify(typeA.outType, typeB.outType, errorContext);
	}

	if ( typeA.contentType || typeB.contentType )
	{
		result.contentType = SWYM.TypeUnify(typeA.contentType, typeB.contentType, errorContext);
	}

	//TODO: unifying argtypes is not really this simple.
	if ( typeA.argType || typeB.argType )
	{
		result.argType = SWYM.TypeUnify(typeA.argType, typeB.argType, errorContext);
	}
	
	if( typeA.memberTypes && typeB.memberTypes )
	{
		var newMemberTypes = {};
		for( var memberName in typeA.memberTypes )
		{
			if( typeB.memberTypes[memberName] !== undefined  )
			{
				newMemberTypes[memberName] = SWYM.TypeUnify(typeA.memberTypes[memberName], typeB.memberTypes[memberName], errorContext);
				foundAny = true;
			}
			else
			{
				newMemberTypes[memberName] = SWYM.TypeUnify(typeA.memberTypes[memberName], SWYM.VoidType, errorContext);
				foundAny = true;
			}
		}
		
		for( var memberName in typeB.memberTypes )
		{
			if( typeA.memberTypes[memberName] === undefined  )
			{
				newMemberTypes[memberName] = SWYM.TypeUnify(typeB.memberTypes[memberName], SWYM.VoidType, errorContext);
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

SWYM.StripBakedInformation = function(baseType, errorContext)
{
	if( baseType.baked === undefined )
	{
		return baseType;
	}
	else if( baseType.isStringChar )
	{
		return SWYM.StringCharType;
	}
	else if( baseType.multivalueOf !== undefined )
	{
		if( baseType.multivalueOf.isStringChar )
		{
			return SWYM.ToMultivalueType(SWYM.StringCharType);
		}
		else
		{
			return SWYM.ToMultivalueType( SWYM.TypeOfValue(baseType.baked, errorContext) );
		}
	}
	else
	{
		return SWYM.TypeOfValue(baseType.baked, errorContext);
	}
}

SWYM.LazyArrayTypeContaining = function(elementType)
{
	var result = SWYM.ArrayTypeContaining(elementType);
	result.isLazy = true;
	result.debugName = "Lazy("+result.debugName+")";
	return result;
}

SWYM.ArrayTypeContaining = function(elementType, isMutable, canBake, errorContext)
{
	if( !elementType )
	{
		SWYM.LogError(errorContext, "ArrayTypeContaining - Expected an element type, got: "+elementType);
		return SWYM.ArrayType;
	}
	
	var outType = SWYM.ToSinglevalueType(elementType);
	var lengthType = elementType.length === undefined? SWYM.IntType: elementType.length;

	var resultType =
	{
		type:"type",
		isMutable:isMutable,
		memberTypes:{length:lengthType, keys:SWYM.IntArrayType},
		argType:SWYM.IntType,
		outType:outType,
		debugName:"Array("+SWYM.TypeToString(outType)+")"
	};
	
	if( elementType.multivalueOf !== undefined )
	{
		if( elementType.tupleTypes !== undefined )
		{
			SWYM.AddTupleInfo(resultType, elementType.tupleTypes, errorContext);
		}
		
		if( elementType.isLazy )
		{
			return SWYM.LazyArrayTypeContaining(outType);
		}
		else if( canBake )
		{
			resultType.baked = elementType.baked;
		}
		
		if( elementType.nativeType !== undefined )
		{
			resultType.nativeType = elementType.nativeType;
		}
	}
	else if( canBake && elementType.baked )
	{
		resultType.baked = SWYM.jsArray([elementType.baked]);
	}
	
	return resultType;
}

SWYM.ArrayToMultivalueType = function(arrayType, quantifier)
{
	if( !arrayType )
	{
		return SWYM.ToMultivalueType(SWYM.DontCareType);
	}
	
	var result;
	if( arrayType.isLazy )
	{
		result = SWYM.ToMultivalueType(SWYM.GetOutType(arrayType), quantifier, arrayType.isMutable);
		result.isLazy = true;
	}
	else
	{
		result = SWYM.ToMultivalueType(SWYM.GetOutType(arrayType), quantifier, arrayType? arrayType.isMutable: undefined);
	}

	if( arrayType.memberTypes && arrayType.memberTypes.length !== SWYM.IntType )
	{
		result.length = arrayType.memberTypes.length;
	}
	
	if( arrayType.tupleTypes )
	{
		result.tupleTypes = arrayType.tupleTypes;
	}
	
	if( arrayType.baked !== undefined )
	{
		result.baked = arrayType.baked;
	}
	
	if( arrayType.nativeType )
	{
		result.nativeType = arrayType.nativeType;
	}
	
	return result;
}

SWYM.FixedLengthStringType = function(length)
{
	return {type:"type", nativeType:"String", argType:SWYM.IntType, outType:SWYM.StringCharType, memberTypes:{"length":SWYM.BakedValue(length), "keys":SWYM.IntArrayType}, debugName:"String("+length+")"};
}

SWYM.TupleTypeOf = function(tupleTypes, elementType, errorContext)
{
	if( elementType === undefined )
	{
		elementType = SWYM.DontCareType;
		for( var Idx = 0; Idx < tupleTypes.length; ++Idx )
		{
			elementType = SWYM.TypeUnify(tupleTypes[Idx], elementType, errorContext);
		}
	}
	var result = SWYM.ArrayTypeContaining(elementType, false, (tupleTypes.length === 1), errorContext);
	SWYM.AddTupleInfo(result, tupleTypes, errorContext);
	return result;
}

SWYM.AddTupleInfo = function(arrayType, tupleTypes, errorContext)
{
	arrayType.tupleTypes = tupleTypes;
	arrayType.memberTypes.length = SWYM.BakedValue(tupleTypes.length, errorContext);
	arrayType.memberTypes.keys = SWYM.IntArrayType;
	
	var debugName = SWYM.TypeToString(tupleTypes[0]);
	for(var Idx = 1; Idx < tupleTypes.length; ++Idx )
	{
		debugName += ","+SWYM.TypeToString(tupleTypes[Idx]);
	}
	arrayType.debugName = "Tuple["+debugName+"]";
}

SWYM.TableTypeFromTo = function(keyType, valueType, isMutable)
{
	return {type:"type", memberTypes:{keys:SWYM.ArrayTypeContaining(keyType)}, argType:keyType, outType:valueType, isMutable:isMutable, debugName:"Table("+SWYM.TypeToString(keyType)+"->"+SWYM.TypeToString(valueType)+")"};
}

SWYM.CallableTypeFromTo = function(argType, outType)
{
	return {type:"type", nativeType:"Callable", argType:argType, outType:outType, debugName:SWYM.TypeToString(argType)+"->"+SWYM.TypeToString(outType)};
}

SWYM.TypeOfValue = function(value, errorContext)
{
	var t = typeof value;
	var result;
	if( value === null )
	{
		return SWYM.VoidType;
	}
	else if( value === SWYM.value_novalues )
	{
		return SWYM.DontCareType;
	}
	else if( t === "number" )
	{
		if( value % 1 == 0 )
			return SWYM.IntType;
		else
			return SWYM.NumberType;
	}
	else if( t === "boolean" )
	{
		return SWYM.BoolType;
	}
	else if( value.type === "string" )
	{
		if( value.isChar )
		{
			return SWYM.StringCharType;
		}
		else if( value.length === 1 )
		{
			return SWYM.String1Type;
		}
		else
		{
			return SWYM.StringType;
		}
	}
	else if( value.type === "jsArray" )
	{
		// TODO: element type
		return SWYM.ArrayType;
	}
	else if( value.type === "rangeArray" )
	{
		return SWYM.RangeArrayType;
	}
	else if( value.type === "type" )
	{
		return SWYM.TypeType;
	}
	else if( value.type === "novalues" )
	{
		return SWYM.NoValues;
	}
	else
	{
		SWYM.LogError(errorContext, "Fsckup: Unrecognized value '"+SWYM.ToDebugString(value)+"' passed to TypeOfValue");
		return {type:"type"};
	}
}

SWYM.BakedValue = function(value, errorContext)
{
	var baseType = SWYM.TypeOfValue(value, errorContext);
	var result = object(baseType);
	if( baseType === SWYM.StringType )
	{
		result.memberTypes = object(baseType.memberTypes);
		result.memberTypes.length = SWYM.BakedValue(value.length);
	}
	else if( baseType === SWYM.ArrayType )
	{
		result.memberTypes = object(result.memberTypes);
		result.memberTypes.length = SWYM.BakedValue(value.length);
		if( value.length === 0 )
		{
			result.outType = SWYM.DontCareType;
		}
	}

	result.baked = value;
	result.debugName = "Literal("+SWYM.ToDebugString(value)+")";
	return result;
}

SWYM.GetArgType = function(callableType, errorContext)
{
	if( callableType.argType !== undefined )
	{
		return callableType.argType;
	}
	
	if( callableType.needsCompiling )
	{
		var argNode = callableType.argNode;
		
		if( argNode !== undefined &&
			argNode.op !== undefined &&
			argNode.op.text === "(" &&
			argNode.children[0] === undefined &&
			argNode.children[1] !== undefined )
		{
			argNode = argNode.children[1];
		}

		return SWYM.GetTypeFromPatternNode( argNode, callableType.cscope );
	}
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
	
	var returnType = callableType.outType;
	
/*			for( var Idx = 1; Idx < toCompile.length; ++Idx )
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
	}*/
	
	if( !returnType && callableType.needsCompiling )
	{
		// FIXME: this could be intolerably expensive.
		// should implement type-functions, so we can calculate a return type without recompiling the whole closure each time.
		var unusedExecutable = [];
		returnType = SWYM.CompileLambdaInternal(callableType, argType, unusedExecutable, null);
	}
	else if( !returnType )
	{
		if( !SWYM.errors )
		{
			// This tends to be caused by a previous error, no point raising an additional one
			SWYM.LogError(errorContext, "Fsckup: OutType of callable "+SWYM.TypeToString(callableType)+" is missing. (failed to compile?)");
		}
		return SWYM.DontCareType;
	}
	
	if( callableType.argType )
	{
		SWYM.TypeCoerce(callableType.argType, argType, errorContext, "Argument to 'do'("+SWYM.TypeToString(callableType)+")");
	}
	
	// TODO: make sure this callable is pure before running it at compile time!
	// ...the world is not yet ready...
/*	if( callableType.baked !== undefined && argType && argType.baked !== undefined &&
		callableType.run !== undefined )
	{
		var value = SWYM.ClosureCall(callableType.baked, argType.baked);
		return SWYM.BakedValue(value);
	}*/
	
	if( callableType.tupleTypes && argType && argType.baked !== undefined )
	{
		return callableType.tupleTypes[argType.baked];
	}

	if( isMultivalue )
	{
		return SWYM.ToMultivalueType(returnType, quantifier);
	}
	else
	{
		return returnType;
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

SWYM.ToMultivalueType = function(type, quantifier, isMutable, lengthType)
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
			
			return {type:"type", multivalueOf:type.multivalueOf, isMutable:isMutable, quantifier:quantifier_A.concat(quantifier_B), length:lengthType, debugName:type.debugName};
//		}
	}
	else
	{
		return {type:"type", multivalueOf:type, isMutable:isMutable, quantifier:quantifier,
			length:lengthType, debugName:SWYM.TypeToString(type)+"*" };
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

SWYM.onLoad("swymTypeCheck.js");