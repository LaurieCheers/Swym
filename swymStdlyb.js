//=================================================================================

SWYM.NextClassID = 8001;

// We have a big discrepancy between the (relatively simple) compile-time types,
// and the (fairly complex) run-time types. For example, at run-time we distinguish
// lazy evaluated lists from eagerly-evaluated ones; at compile time we don't.
// The .run functions are only used to identify whether a run-time object is valid.
// At compile time we require type IDs to tell us what is a subtype of what.
//
//                          Value
//        +-----------+-------+-------+-------+------+----------+----------+
//      Type        Array   Block   Table   Number  Bool  <structinst> <enuminst>
//   +----+---+       |                       |
// Struct    Enum   String                   Int
//
// Interesting issue - do we need two root objects, one for callables and one for noncallables?
// Is Array a subtype of Table? They're basically compatible, except arrays renumber their keys; tables never do. :-/
// Is an array a struct? Are there any predefined struct types? Can structs be callable?
// How do we let arrays define their own "contains" or "random" methods?
// Is Bool an enum? Should the type Struct match struct types, or struct instances?
// Maybe StructType (and EnumType) should match struct types, and Struct should match all instances of all StructTypes.
// maybe defining Struct as a type at all would just cause confusion and be useless in practise.
// Can you say Bool.values (or the equivalent for any given enum) to get the list of possible values?
// Is every enum type actually an instance of a struct, to allow you to go "Color.RED" or whatever? Careful -
// that means any function you can call on all enums (such as .values), or on all types, will conflict with
// enum value names!
// Do we even have/want subtypes? What if we just do mixins for everything?

// predefined mixins: GreaterThan, GreaterThanOrEq, LessThan, LessThanOrEq, MultipleOf,
// Baked, Members, native_Number, native_String, native_Array, native_Table

// 'Type' = Value->Bool & Baked & native_Type
// 'Array' = Number->auto & Members{ 'length':Int }
// 'StringChar' = Number->StringChar & Members{ 'length'=1 }
// 'String' = Number->StringChar & Members{ 'length':Nat }
// 'Table' = Callable & Members{ 'keys':Array }
// 'Block' = Callable & Members{ 'text':String, 'parsed':ParseNode }
// 'Bool' = enum{ 'true'=true, 'false'=false }
// 'Int' = Number & MultipleOf(1)
// 'Nat' = Number & MultipleOf(1) & GreaterOrEq(0)

SWYM.AnyType = {type:"type", debugName:"Value"};
SWYM.BoolType = {type:"type", enumValues:SWYM.jsArray([true, false]), debugName:"Bool"};

SWYM.NumberType = {type:"type", nativeType:"Number", debugName:"Number"};
SWYM.IntType = {type:"type", nativeType:"Number", multipleOf:1, debugName:"Int"};
SWYM.VoidType = {type:"type", nativeType:"Void", debugName:"Void"};
SWYM.TypeType = {type:"type", nativeType:"Type", argType:SWYM.AnyType, outType:SWYM.BoolType, debugName:"Type"};
SWYM.StringCharType = {type:"type", nativeType:"String", argType:SWYM.IntType, memberTypes:{"length":SWYM.BakedValue(1)}, debugName:"StringChar"};
SWYM.StringCharType.outType = SWYM.StringCharType;
SWYM.VariableType = {type:"type", nativeType:"Variable", contentsType:SWYM.NoValuesType, debugName:"Variable"};

SWYM.NativeArrayType = {type:"type", nativeType:"JSArray", argType:SWYM.IntType, outType:SWYM.AnyType, memberTypes:{"length":SWYM.IntType}, debugName:"NativeArray"};
SWYM.NativeTableType = {type:"type", nativeType:"JSObject", argType:SWYM.StringType, outType:SWYM.AnyType, memberTypes:{"keys":SWYM.ArrayType}, debugName:"NativeTable"};
SWYM.NativeStringType = {type:"type", nativeType:"String", argType:SWYM.IntType, outType:SWYM.StringCharType, memberTypes:{"length":SWYM.IntType}, debugName:"NativeString"};

SWYM.NoValuesType = {type:"type", nativeType:"NoValues", debugName:"NoValues"};
SWYM.ArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.AnyType, memberTypes:{"length":SWYM.IntType}, debugName:"Array"};
SWYM.TableType = {type:"type", argType:SWYM.NoValuesType, outType:SWYM.AnyType, debugName:"Table"};
SWYM.StringType = {type:"type", argType:SWYM.IntType, outType:SWYM.StringCharType, memberTypes:{"length":SWYM.IntType}, debugName:"String"};
SWYM.CallableType = {type:"type", nativeType:"Callable", argType:SWYM.NoValuesType, outType:SWYM.AnyType, debugName:"Callable"};
SWYM.BlockType = {type:"type", argType:SWYM.NoValuesType, outType:SWYM.AnyType, debugName:"Block"}; // will have members at some point
SWYM.PredicateType = {type:"type", argType:SWYM.AnyType, outType:SWYM.BoolType, debugName:"Predicate"};
SWYM.IntArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.IntType, memberTypes:{"length":SWYM.IntType}, debugName:"Int.Array"};
SWYM.NumberArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.NumberType, memberTypes:{"length":SWYM.IntType}, debugName:"Number.Array"};
SWYM.StringArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.StringType, memberTypes:{"length":SWYM.IntType}, debugName:"String.Array"};
SWYM.StringCharArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.StringCharType, memberTypes:{"length":SWYM.IntType}, debugName:"StringChar.Array"};

SWYM.operators = {
	"(blank_line)":  {precedence:1, infix:true, postfix:true, prefix:true,
		customCompile:function(node, cscope, executable)
		{
			if( node.children[1] )
			{
				if( node.children[0] )
				{
					SWYM.CompileNode(node.children[0], cscope, executable);
					executable.push( "#ClearStack" );
				}
				return SWYM.CompileNode(node.children[1], cscope, executable);
			}
			else
			{
				return SWYM.CompileNode(node.children[0], cscope, executable);
			}
		}
	},

	";":  {precedence:1, infix:true, postfix:true,
		customCompile:function(node, cscope, executable)
		{
			if( node.children[1] )
			{
				SWYM.CompileNode(node.children[0], cscope, executable);
				executable.push( "#ClearStack" );
				return SWYM.CompileNode(node.children[1], cscope, executable);
			}
			else
			{
				return SWYM.CompileNode(node.children[0], cscope, executable);
			}
		}
	},

	"yield": {precedence:10, prefix:true,
		customCompile:function(node, cscope, executable)
		{
			var parentFunction = cscope["<withinFunction>"];
			if( !parentFunction )
			{
				SWYM.LogError(0, "Illegal yield - cannot yield when there's no enclosing function!");
				return undefined;
			}
			
			parentFunction.yields = true;

			//FIXME: these are actually incorrect, but I'm not sure how to fix it yet. Recursive function calls are tricky.
			parentFunction.returnType = SWYM.ArrayType;
			parentFunction.bodyCScope["Yielded"] = SWYM.ArrayTypeContaining(SWYM.NoValuesType);

			SWYM.pushEach(["#Load", "Yielded"], executable);
						
			var yieldType = SWYM.CompileNode(node.children[1], cscope, executable);
			if( !yieldType || yieldType.multivalueOf === undefined )
			{
				executable.push("#ToMultivalue");
			}

			SWYM.pushEach(["#ConcatArrays", 2, "#Overwrite", "Yielded", "#Pop"], executable);
			
			if( parentFunction.returnType === undefined )
				parentFunction.returnType = SWYM.ArrayTypeContaining(yieldType);
			else
				parentFunction.returnType = SWYM.TypeUnify(parentFunction.returnType, SWYM.ArrayTypeContaining(yieldType));
			parentFunction.bodyCScope["Yielded"] = parentFunction.returnType;
		}},
		
	"return": {precedence:11, prefix:true, standalone:true,
		customCompile:function(node, cscope, executable)
		{
			var parentFunction = cscope["<withinFunction>"];
			if( !parentFunction )
			{
				SWYM.LogError(0, "Illegal return - cannot return when there's no enclosing function!");
				return undefined;
			}
			
			if( node.children[1] )
			{
				parentFunction.returnsValue = true;
				
				var returnType = SWYM.CompileNode(node.children[1], cscope, executable);
				if( returnType && returnType.multivalueOf !== undefined )
				{
					returnType = SWYM.ToSinglevalueType(returnType);
					executable.push("#ForceSingleValue");
				}
				parentFunction.returnType = returnType;
				executable.push("#Return");
			}
			else
			{
				parentFunction.returnsNoValue = true;
				executable.push("#Return");
			}
			
			return SWYM.VoidType;
		}},
	
	",":  {precedence:20, infix:true, postfix:true, identity:function(){ return [] },
		customCompile:function(node, cscope, executable)
		{
			// compose a tree of comma operators into a single list expression.
			var commaExp = node;
			var args = [];
			while(commaExp)
			{
				if( commaExp.op && commaExp.op.text === "," )
				{
					if( commaExp.children[1] )
						args.unshift(commaExp.children[1]); // push front
						
					commaExp = commaExp.children[0];
				}
				else
				{
					args.unshift(commaExp);
					break;
				}
			}
			
			if( args.length === 1 )
			{
				var rtype = SWYM.CompileNode( args[0], cscope, executable );
				return rtype;
			}

			var isMulti = false;
			var executables = [];
			var resultType = undefined;
			for( var Idx = 0; Idx < args.length; ++Idx )
			{
				var executableN = [];
				var typeN = SWYM.CompileNode( args[Idx], cscope, executableN );
				
				if( typeN && typeN.multivalueOf !== undefined )
				{
					if( !isMulti )
					{
						isMulti = true;
						for( var Jdx = 0; Jdx < Idx; ++Jdx )
						{
							executables[Jdx].push("#ToMultivalue");
						}
						
						if( resultType !== undefined )
						{
							resultType = SWYM.ToMultivalueType(resultType);
						}
					}
				}
				else if ( isMulti )
				{
					executableN.push("#ToMultivalue");
					typeN = SWYM.ToMultivalueType(typeN);
				}

				if( resultType !== undefined )
				{
					resultType = SWYM.TypeUnify(resultType,typeN);
				}
				else
				{
					resultType = typeN;
				}
				
				executables.push(executableN);
			}
			
			for( var Idx = 0; Idx < executables.length; ++Idx )
			{
				SWYM.pushEach(executables[Idx], executable);
			}

			executable.push( isMulti ? "#ConcatArrays" : "#CreateArray" );
			executable.push(executables.length);
			return SWYM.ToMultivalueType(resultType);
		}
	},

	":":  {precedence:30, infix:true,
		customCompile:function(node, cscope, executable)
		{
			SWYM.LogError(0, "':' is illegal in this context.");
		}
	},
	
	"=":  {precedence:45, infix:true,
		customCompile:function(node, cscope, executable)
		{
			if( node.children[0] && node.children[1] && node.children[0].type === "decl" )
			{
				// declare a value
				var typecheck = SWYM.CompileLValue(node.children[1], cscope, executable);

				if( typecheck && typecheck.multivalueOf !== undefined )
				{
					executable.push( "#ForceSingleValue" );
					typecheck = SWYM.ToSinglevalueType(typecheck);
				}
					
				executable.push( "#Store" );
				executable.push( node.children[0].value );

				if( cscope.hasOwnProperty(node.children[0].value) )
				{
					SWYM.LogError(node.pos, "Tried to redefine \""+node.children[0].value+"\"");
				}
				else
				{
					cscope[node.children[0].value] = typecheck;
				}

				// If this just declared a class, name the class after this variable name
				if( typecheck && typecheck.baked && typecheck.baked.type === "type" && !typecheck.baked.debugName )
				{
					typecheck.baked.debugName = node.children[0].value;
				}
			}
			else if ( node.children[0] && node.children[1] && node.children[0].type === "fnnode" && node.children[0].isDecl )
			{
				// declare a function
				if( node.children[1].op && node.children[1].op.text === "{" && !node.children[1].children[0] )
				{
					// "Bar.'foo' = {...}" style function declaration.
					node.children[0].body = node.children[1].children[1];
				}
				else
				{
					// "Bar.'foo' = ..." style function declaration.
					node.children[0].body = node.children[1];
				}
				return SWYM.CompileNode(node.children[0], cscope, executable);
			}
//			else if ( node.children[0] && node.children[1] && node.children[0].op && node.children[0].op.text === "is" && node.children[0].children[1].type === "decl" )
//			{
//				// declare a closure-pattern
//				var declName = node.children[0].children[1].value;
//				var type1 = SWYM.CompileNode(node.children[1], cscope, executable);
//				type1 = SWYM.TypeCoerce({type:"closure", returnType:SWYM.BoolType}, type1, "is '"+declName+"' style declaration");
//				
//				executable.push( "#Store" );
//				executable.push( declName );
//
//				if( cscope.hasOwnProperty(declName) )
//				{
//					SWYM.LogError(node.pos, "Tried to redefine \""+declName+"\"");
//				}
//				else
//				{
//					cscope[declName] = type1;
//				}
//			}
			else
			{
				// ordinary assignment
				var type0 = SWYM.CompileLValue(node.children[0], cscope, executable);
				var type1 = SWYM.CompileNode(node.children[1], cscope, executable);
				
				SWYM.TypeCoerce(SWYM.VariableType, type0, "Left hand side of the = operator");
				
				executable.push("#VariableAssign");
				
				return type0;
			}
		}
	},
	"+=": {precedence:50, argTypes:[undefined, SWYM.NumberType], returnType:SWYM.VoidType, infix:true,
			customCompile:function(node, cscope, executable)
			{
				var varType = SWYM.CompileLValue(node.children[0], cscope, executable);
				executable.push("#Dup");
				executable.push("#VariableContents");
				var modType = SWYM.CompileNode(node.children[1], cscope, executable);
				executable.push("#Add");
				executable.push("#VariableAssign");
				SWYM.TypeCoerce(SWYM.VariableTypeContaining(SWYM.NumberType), varType, "+=");
				return varType;
			}
		},
	"-=": {precedence:50, argTypes:[SWYM.VarType, SWYM.NumberType], infix:true, returnType:SWYM.VoidType,
			customCompile:function(node, cscope, executable)
			{
				var varType = SWYM.CompileLValue(node.children[0], cscope, executable);
				executable.push("#Dup");
				executable.push("#VariableContents");
				var modType = SWYM.CompileNode(node.children[1], cscope, executable);
				executable.push("#Sub");
				executable.push("#VariableAssign");
				SWYM.TypeCoerce(SWYM.VariableTypeContaining(SWYM.NumberType), varType, "-=");
				return varType;
			}
		},
	"*=": {precedence:50, argTypes:[SWYM.VarType, SWYM.NumberType], infix:true, returnType:SWYM.VoidType,
			customCompile:function(node, cscope, executable)
			{
				var varType = SWYM.CompileLValue(node.children[0], cscope, executable);
				executable.push("#Dup");
				executable.push("#VariableContents");
				var modType = SWYM.CompileNode(node.children[1], cscope, executable);
				executable.push("#Mul");
				executable.push("#VariableAssign");
				SWYM.TypeCoerce(SWYM.VariableTypeContaining(SWYM.NumberType), varType, "+=");
				return varType;
			}
		},
	"/=": {precedence:50, argTypes:[SWYM.VarType, SWYM.NumberType], infix:true, returnType:SWYM.VoidType,
			customCompile:function(node, cscope, executable)
			{
				var varType = SWYM.CompileLValue(node.children[0], cscope, executable);
				executable.push("#Dup");
				executable.push("#VariableContents");
				var modType = SWYM.CompileNode(node.children[1], cscope, executable);
				executable.push("#Div");
				executable.push("#VariableAssign");
				SWYM.TypeCoerce(SWYM.VariableTypeContaining(SWYM.NumberType), varType, "+=");
				return varType;
			}
		},
	"%=": {precedence:50, argTypes:[SWYM.VarType, SWYM.NumberType], infix:true, returnType:SWYM.VoidType,
			customCompile:function(node, cscope, executable)
			{
				var varType = SWYM.CompileNode(node.children[0], cscope, executable);
				executable.push("#Dup");
				executable.push("#VariableContents");
				var modType = SWYM.CompileNode(node.children[1], cscope, executable);
				executable.push("#Mod");
				executable.push("#VariableAssign");
				SWYM.TypeCoerce(SWYM.VariableTypeContaining(SWYM.NumberType), varType, "+=");
				return varType;
			}
		},
		
	// the 'repeat' operator. 10**3 -> 10,10,10
	"**": {precedence:104, infix:true, argTypes:[SWYM.AnyType, SWYM.IntType],
		customCompile:function(node, cscope, executable)
		{
			var type0 = SWYM.CompileNode( node.children[0], cscope, executable );
			var type1 = SWYM.CompileNode( node.children[1], cscope, executable );
		
			if( type1 && type1.multivalueOf !== undefined )
				SWYM.LogError(0, "Error: Right-hand side of the ** operator cannot be a multi-value.");

			executable.push("#Native");
			executable.push(2);
			if( !type0 || type0.multivalueOf === undefined )
			{
				executable.push( function(v,n)
				{
					var result = SWYM.jsArray([]);
					while( --n >= 0 )
						result.push(v);
					return result;
				});
			}
			else
			{
				executable.push( function(vs,n)
				{
					var result = SWYM.jsArray([]);
					while( --n >= 0 )
					{
						for( var Idx = 0; Idx < vs.length; ++Idx )
							result.push(vs[Idx]);
					}

					return result;
				});
			}
			
			return SWYM.ToMultivalueType(type0);
		}
	},

	"&&": {precedence:60, infix:true, identity:function(v){ return true; },
		returnType:SWYM.BoolType,
		customCompile:function(node, cscope, executable)
		{
			var executable2 = [];
			var type1 = SWYM.CompileNode( node.children[1], cscope, executable2 );
			type1 = SWYM.TypeCoerce(SWYM.BoolType, type1, "&& operator arguments");

			var type0 = SWYM.CompileNode( node.children[0], cscope, executable );
			type0 = SWYM.TypeCoerce(SWYM.BoolType, type0, "&& operator arguments");

			executable.push("#IfElse");
			executable.push(executable2); // then
			executable.push(["#Literal", false]); // else
			
			return SWYM.BoolType;
		}},
	"||": {precedence:60, infix:true, identity:function(v){ return false; },
		returnType:SWYM.BoolType,
		customCompile:function(node, cscope, executable)
		{
			var executable2 = [];
			var type1 = SWYM.CompileNode( node.children[1], cscope, executable2 );
			type1 = SWYM.TypeCoerce(SWYM.BoolType, type1, "|| operator arguments");

			var type0 = SWYM.CompileNode( node.children[0], cscope, executable );
			type0 = SWYM.TypeCoerce(SWYM.BoolType, type0, "|| operator arguments");

			executable.push("#IfElse");
			executable.push(["#Literal", true]); // then
			executable.push(executable2); // else

			return SWYM.BoolType;
		}},
	"!": {precedence:65, prefix:true,
		customCompile:function(node, cscope, executable)
		{
			var type1 = SWYM.CompileNode( node.children[1], cscope, executable );
			
			if( SWYM.TypeMatches(SWYM.BoolType, type1) )
			{
				// logical 'not'
				if( type1.multivalueOf !== undefined )
					executable.push("#MultiNative");
				else
					executable.push("#Native");
					
				executable.push(1);
				executable.push(function(v){return !v});
				
				return type1;
			}
			else if( SWYM.TypeMatches({type:"closure", returnType:SWYM.BoolType}, type1) )
			{
				// negate closure... is this useful/wise?
				if( type1.multivalueOf !== undefined )
					executable.push("#MultiNative");
				else
					executable.push("#Native");
				
				executable.push(1);
				executable.push(function(v){return {
					type:"closure",
					debugName:"auto_not("+SWYM.ToDebugString(v)+")",
					argName:"c",
					scope:{},
					body:["#Load", "c", "#Literal", SWYM.ValueToClosure(v), "#ClosureCall", "#MultiNative", 1, function(v){return !v}]
				}});
				
				return type1;
			}
			else
			{
				SWYM.LogError(0, "Error - illegal argument to the Not operator.");
				return SWYM.NoValuesType;
			}
		}},
	
	// range operators:
	// ascending or descending sequence that includes both endpoints.
	"..":  {precedence:75, infix:true,
		customCompile:function(node, cscope, executable)
		{
			var type0 = SWYM.CompileNode( node.children[0], cscope, executable );
			if( SWYM.TypeMatches(SWYM.IntType, type0 ) )
			{
				var type1 = SWYM.CompileNode( node.children[1], cscope, executable );
				if( SWYM.TypeMatches(SWYM.IntType, type1 ) )
				{
					executable.push("#Native");
					executable.push(2);
					executable.push( function(a,b){ return SWYM.RangeOp(a,b, true, true, undefined) });
					return SWYM.ToMultivalueType(SWYM.IntType);
				}
				else
				{
					SWYM.LogError("Inconsistent arguments for '..' operator: "+SWYM.TypeToString(type0)+" and "+SWYM.TypeToString(type1));
					return;
				}
			}
			
			type0 = SWYM.TypeCoerce(SWYM.StringType, type0, ".. operator arguments");
			var type1 = SWYM.CompileNode( node.children[1], cscope, executable );
			type1 = SWYM.TypeCoerce(SWYM.StringType, type1, ".. operator arguments");

			executable.push("#Native");
			executable.push(2);
			executable.push( function(a,b){ return SWYM.CharRange(a,b) });
			return SWYM.ToMultivalueType(SWYM.StringCharType);
		}},
	// ascending sequence that includes left, right, neither or both endpoints
	"..<": {precedence:75, argTypes:[SWYM.IntType,SWYM.NumberType], returnType:SWYM.ToMultivalueType(SWYM.IntType), infix:function(a,b){ return SWYM.RangeOp(a,b, true, false, 1); }},
	"<..": {precedence:75, argTypes:[SWYM.NumberType,SWYM.IntType], returnType:SWYM.ToMultivalueType(SWYM.IntType), infix:function(a,b){ return SWYM.RangeOp(a,b, false, true, 1); }},
	"<..<":{precedence:75, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.ToMultivalueType(SWYM.IntType), infix:function(a,b){ return SWYM.RangeOp(a,b, false, false, 1); }},
	"..<..":{precedence:75, argTypes:[SWYM.IntType,SWYM.IntType], returnType:SWYM.ToMultivalueType(SWYM.IntType), infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, 1); }},
	// descending sequence that excludes left, right, neither or both endpoints
	"..>": {precedence:75, argTypes:[SWYM.IntType,SWYM.NumberType], returnType:SWYM.ToMultivalueType(SWYM.IntType), infix:function(a,b){ return SWYM.RangeOp(a,b, true, false, -1); }},
	">..": {precedence:75, argTypes:[SWYM.NumberType,SWYM.IntType], returnType:SWYM.ToMultivalueType(SWYM.IntType), infix:function(a,b){ return SWYM.RangeOp(a,b, false, true, -1); }},
	">..>":{precedence:75, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.ToMultivalueType(SWYM.IntType), infix:function(a,b){ return SWYM.RangeOp(a,b, false, false, -1); }},
	"..>..":{precedence:75, argTypes:[SWYM.IntType,SWYM.IntType], returnType:SWYM.ToMultivalueType(SWYM.IntType), infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, -1); }},
	
	"==": {precedence:80, returnType:SWYM.BoolType, infix:SWYM.IsEqual },
	"!=": {precedence:80, returnType:SWYM.BoolType, infix:function(a,b){return !SWYM.IsEqual(a,b)}},

	// "v ==any P" and "v ==some P" are the same as "P.contains(v)".
	"==any": {precedence:80, argTypes:[SWYM.AnyType, SWYM.ArrayType], returnType:SWYM.BoolType,
		infix:function(a,b) { return SWYM.ArrayContains(b, a); }
	},

	"==some": {precedence:80, argTypes:[SWYM.AnyType, SWYM.ArrayType], returnType:SWYM.BoolType,
		infix:function(a,b) { return SWYM.ArrayContains(b, a); }
	},

	// "v !=any P" is the same as "P.!contains(v)"
	"!=any": {precedence:80, argTypes:[SWYM.AnyType, SWYM.ArrayType], returnType:SWYM.BoolType,
		infix:function(a,b){ return !SWYM.ArrayContains(b, a); }
	},
	
	">":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.BoolType, infix:function(a,b){return a>b} },
	">=": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.BoolType, infix:function(a,b){return a>=b} },
	"<":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.BoolType, infix:function(a,b){return a<b} },
	"<=": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.BoolType, infix:function(a,b){return a<=b} },

	">every":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a <= b.run(Idx) )
					return false;
			return true;
		}
	},
	">=every": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a < b.run(Idx) )
					return false;
			return true;
		}
	},
	"<every":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a >= b.run(Idx) )
					return false;
			return true;
		}
	},
	"<=every": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a > b.run(Idx) )
					return false;
			return true;
		}
	},
	">some":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a > b.run(Idx) )
					return true;
			return false;
		}
	},
	">=some": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a >= b.run(Idx) )
					return true;
			return false;
		}
	},
	"<some":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a < b.run(Idx) )
					return true;
			return false;
		}
	},
	"<=some": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a <= b.run(Idx) )
					return true;
			return false;
		}
	},

	// nice to have, though probably not as useful: "==every", ">every", "<every", ">=every", "<=every", ">some", "<some", ">=some", "<=some"
	
	"--": {precedence:91,
			prefix:function(a,b,op){return SWYM.assignmentOp(b,{value:b.value-1},op);},
			postfix:function(a,b,op){ var temp = a.value; SWYM.assignmentOp(a,{value:a.value-1},op); return {value:temp}; }
		},
	
	"&bitwise": {precedence:96, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.NumberType, infix:function(a,b){return a&b}, identity:function(){return ~0;} },
	"|bitwise": {precedence:96, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.NumberType, infix:function(a,b){return a|b}, identity:function(){return 0;} },
	"^bitwise": {precedence:96, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.NumberType, infix:function(a,b){return a^b} },
	"~bitwise": {precedence:96, argTypes:[SWYM.NumberType], returnType:SWYM.NumberType, prefix:function(v){return ~v} },

/*	"-": {precedence:102, returnType:{type:"Number"}, prefix:true, infix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( lhs !== undefined )
			{
				return {type:"fnnode", body:undefined, isDecl:false,
					name:"-",
					etc:op.etc,
					children:[rhs, lhs],
					argNames:["__", "this"]
				};
			}
			else
			{
				return {type:"fnnode", body:undefined, isDecl:false,
					name:"-",
					etc:op.etc,
					children:[rhs],
					argNames:["__"]
				};
			}
		}},*/
	"-": {precedence:101, argTypes:[SWYM.NumberType,SWYM.NumberType],
		getReturnType:function(a,b)
		{
			if( (a === undefined || SWYM.TypeMatches(SWYM.IntType, a)) && SWYM.TypeMatches(SWYM.IntType, b) )
				return SWYM.IntType;
			else
				return SWYM.NumberType;
		},
		infix:function(a,b){return a-b}, prefix:function(v){return -v}
	},

	"+": {precedence:102, returnType:{type:"Number"}, infix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			return {type:"fnnode", body:undefined, isDecl:false,
				name:"+",
				etc:op.etc,
				identity:0,
				children:[lhs, rhs],
				argNames:["this", "__"]
			};
		}},
		
/*	"+": {precedence:102, returnType:{type:"Number"}, infix:function(a,b){return a+b; }, identity:function(){return 0;},
			customCompile:function(node, cscope, executable)
			{
				var executable1 = [];
				var type1 = SWYM.CompileNode(node.children[0], cscope, executable1);
				var executable2 = [];
				var type2 = SWYM.CompileNode(node.children[1], cscope, executable2);
				
				if( SWYM.TypeMatches(SWYM.NumberType, type1) )
				{
					type2 = SWYM.TypeCoerce(SWYM.NumberType, type2, "Number + ...");

					if ( type1 && type1.multivalueOf !== undefined && type2 && type2.multivalueOf !== undefined )
					{
						// add two multis
						SWYM.pushEach(executable1, executable);
						SWYM.pushEach(executable2, executable);
						executable.push("#MultiNative");
						executable.push(2);
						executable.push(function(a,b){return a+b;});
						return SWYM.ToMultivalueType(SWYM.NumberType);
					}
					else if( !(type1 && type1.multivalueOf !== undefined) && type2 && type2.multivalueOf !== undefined )
					{
						SWYM.pushEach(executable1, executable);
						SWYM.pushEach(executable2, executable);
						executable.push("#AddEach");
						return SWYM.ToMultivalueType(SWYM.NumberType);
					}
					else if( type1 && type1.multivalueOf !== undefined && !(type2 && type2.multivalueOf !== undefined) )
					{
						// just adding numbers, so the order is irrelevant
						SWYM.pushEach(executable2, executable);
						SWYM.pushEach(executable1, executable);
						executable.push("#AddEach");
						return SWYM.ToMultivalueType(SWYM.NumberType);
					}
					else
					{
						SWYM.pushEach(executable1, executable);
						SWYM.pushEach(executable2, executable);
						executable.push("#Add");
						return SWYM.NumberType;
					}
				}
				else if( SWYM.TypeMatches(SWYM.ArrayType, type1) )
				{
					type2 = SWYM.TypeCoerce(SWYM.ArrayType, type2, "Array + ...");

					if ( type1 && type1.multivalueOf !== undefined || type2 && type2.multivalueOf !== undefined )
					{
						if ( !(type2 && type2.multivalueOf !== undefined) )
						{
							executable2.push("#ToMultivalue");
							type2 = SWYM.ToMultivalueType(type2);
							var resultType = SWYM.ToMultivalueType(SWYM.ArrayTypeContaining(SWYM.TypeUnify(type1.multivalueOf.outType, type2.outType, "+ operator arguments")));
						}
						else if ( !(type1 && type1.multivalueOf !== undefined) )
						{
							executable1.push("#ToMultivalue");
							type1 = SWYM.ToMultivalueType(type1);
							var resultType = SWYM.ToMultivalueType(SWYM.ArrayTypeContaining(SWYM.TypeUnify(type1.outType, type2.multivalueOf.outType, "+ operator arguments")));
						}
						else
						{
							var resultType = SWYM.ToMultialueType(SWYM.ArrayTypeContaining(SWYM.TypeUnify(type1.multivalueOf.outType, type2.multivalueOf.outType, "+ operator arguments")));
						}
					}
					else
					{
						var resultType = SWYM.ArrayTypeContaining(SWYM.TypeUnify(type1.outType, type2.outType, "+ operator arguments"));
					}

					SWYM.pushEach(executable1, executable);
					SWYM.pushEach(executable2, executable);
					
					if( (type1 && type1.multivalueOf !== undefined) || (type2 && type2.multivalueOf !== undefined) )
						executable.push("#MultiNative");
					else
						executable.push("#Native");
					executable.push(2);
					executable.push( function(a,b){ return SWYM.Concat(a,b) } );
					return resultType;					
				}
				else
				{
					SWYM.LogError(node.children[0].pos, "Expected Number or Array, got "+SWYM.TypeToString(type1)+". (context: + operator arguments.)");
				}
			}
		},
*/
		
	"*": {precedence:103, argTypes:[SWYM.NumberType,SWYM.NumberType],
		getReturnType:function(a,b)
		{
			if( SWYM.TypeMatches(SWYM.IntType, a) && SWYM.TypeMatches(SWYM.IntType, b) )
				return SWYM.IntType;
			else
				return SWYM.NumberType;
		},
		infix:function(a,b){return a*b}, identity:function(){return 1;}
	},
	"/": {precedence:104, argTypes:[SWYM.NumberType,SWYM.NumberType],
		getReturnType:function(a,b)
		{
			if( SWYM.TypeMatches(SWYM.IntType, a) && SWYM.TypeMatches(SWYM.IntType, b) )
				return SWYM.IntType;
			else
				return SWYM.NumberType;
		},
		infix:function(a,b){return a/b}
	},
	"%": {precedence:105, argTypes:[SWYM.NumberType,SWYM.NumberType],
		getReturnType:function(a,b)
		{
			if( SWYM.TypeMatches(SWYM.IntType, a) && SWYM.TypeMatches(SWYM.IntType, b) )
				return SWYM.IntType;
			else
				return SWYM.NumberType;
		},
		infix:function(a,b){return a%b}
	},
	"^": {precedence:106, argTypes:[SWYM.NumberType,SWYM.NumberType],
		getReturnType:function(a,b)
		{
			if( SWYM.TypeMatches(SWYM.IntType, a) && SWYM.TypeMatches(SWYM.IntType, b) )
				return SWYM.IntType;
			else
				return SWYM.NumberType;
		},
		infix:Math.pow
	}, 	// power operator. foo^2 is foo squared.

	".": { precedence:300, prefix:true, infix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			return SWYM.BuildDotNode(lhs, op, rhs);
		}
	},
	
	// logically negated function call, e.g. bob.!likes(jim)
	".!": { precedence:300, returnType:SWYM.BoolType, standalone:true, prefix:true, infix:true, postfix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			return SWYM.BuildDotNode(lhs, op, rhs, SWYM.operators["!"]);
		}
	},

	// toStringed function call, e.g. bob.$age
	".$": { precedence:300, returnType:SWYM.StringType, standalone:true, prefix:true, infix:true, postfix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			return SWYM.BuildDotNode(lhs, op, rhs, SWYM.operators["$"]);
		}
	},

	// toDebugStringed function call, e.g. bob.$$name
	".$$": { precedence:300, returnType:SWYM.StringType, standalone:true, prefix:true, infix:true, postfix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			return SWYM.BuildDotNode(lhs, op, rhs, SWYM.operators["$$"]);
		}
	},

	// Postfix version of the square bracket operator
	".[]": { precedence:300, returnType:SWYM.ArrayType, standalone:true, postfix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs )
				lhs = SWYM.NewToken("name", op.pos, "__default"); // ".[]" on its own means "__default.[]".

			op.behaviour = SWYM.operators["["];

			return SWYM.NonCustomParseTreeNode(undefined, op, lhs); //NB: lhs on the right
		}
	},

	// function-esque operators, e.g. length./2
	".+": { precedence:300, returnType:SWYM.NumberType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("+") },
	// NB: no function-esque unary negation operator. (Maybe there should be, but it just reads weirdly to me.)
	".-": { precedence:300, returnType:SWYM.NumberType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("-") },
	".*": { precedence:300, returnType:SWYM.NumberType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("*") },
	"./": { precedence:300, returnType:SWYM.NumberType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("/") },
	".%": { precedence:300, returnType:SWYM.NumberType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("%") },
	".=": { precedence:300, returnType:SWYM.NumberType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("=") },
	".<": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("<") },
	".>": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode(">") },
	".<=": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("<=") },
	".>=": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode(">=") },
	".==": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("==") },
	".!=": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("!=") },
	".==some": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("==some") },
	".==any": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("==any") },
	".!=any": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("!=any") },
	".>every": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode(">every") },
	".<every": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("<every") },
	".>=every": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode(">=every") },
	".<=every": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("<=every") },
	".>some": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode(">some") },
	".<some": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("<some") },
	".>=some": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode(">=some") },
	".<=some": { precedence:300, returnType:SWYM.BoolType, prefix:true, infix:true, customParseTreeNode:SWYM.FunctionesqueParseTreeNode("<=some") },

	// terse stringify operator: $$["hello world",[3,"woot"]] -> "hello world3woot"
	"$": {precedence:310, returnType:SWYM.StringType, prefix:function(v){ return SWYM.StringWrapper(SWYM.ToTerseString(v)); }},

	// debug stringify operator: $$["hello world",[3,"woot"]] -> "["hello world",[3,"woot"]]".
	//Mnemonic: $$ is longer than $, and $$ output is longer.
	"$$": {precedence:310, returnType:SWYM.StringType, prefix:true,
		customCompile:function(node, cscope, executable)
		{
			var type1 = SWYM.CompileNode( node.children[1], cscope, executable );
			if( type1 && type1.multivalueOf !== undefined )
			{
				executable.push("#ToMultiDebugString");
				return SWYM.ToMultivalueType(SWYM.StringType);
			}
			else
			{
				executable.push("#ToDebugString");
				return SWYM.StringType;
			}
		}
	},

	// alternate function call operator
	"~": {precedence:320, infix:true, leftAssociative:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( lhs && lhs.type === "name" )
			{
				return {type:"fnnode", body:undefined, isDecl:false, name:lhs.text, children:[rhs], argNames:["__"]};
			}
			else
			{
				SWYM.LogError(0, "~ operator expects an identifier on the left hand side");
			}
		},
		customCompile:function(node, cscope, executable)
		{
			SWYM.LogError(0, "Fsckup - failed to use customParseTreeNode for the '~' operator.");
		}
	},

	"else": { precedence:330, infix:true, standalone:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs && !rhs )
			{
				// else as an identifier
				return SWYM.NewToken("name", op.pos, "else");
			}
			
			if( !rhs || !rhs.op || (rhs.op.text !== "{" && rhs.op.text !== "(" && rhs.op.text !== "[") )
			{
				// else without a bracket will automagically turn its right hand side into a closure
				var curly = SWYM.NewToken("op", op.pos, "{");
				curly.endSourcePos = op.pos+3; //this closure will tostring as the word "else". Not ideal, but better than nothing.
				var rhs = SWYM.ParseTreeNode(undefined, curly, rhs);
			}

			var result = {type:"fnnode", body:undefined, isDecl:undefined, name:undefined, children:[rhs], argNames:["else"]};
			return SWYM.CombineFnNodes(lhs, result);
		}
	},
	
	"(": { precedence:330, takeCloseBracket:")", prefix:true, infix:true, debugText:"parenth",
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs )
				return SWYM.NonCustomParseTreeNode(lhs, op, rhs);

			// function call
			var params = {type:"fnnode", body:undefined, isDecl:undefined, name:undefined, children:[], argNames:[]};
			SWYM.ReadParamBlock(rhs, params);
			return SWYM.CombineFnNodes(lhs, params);
		},
		customCompile:function(node, cscope, executable)
		{
			// only bracketed expressions (i.e. plain old BODMAS) get here
			return SWYM.CompileNode(node.children[1], cscope, executable);
		}
	},
	"[": { precedence:330, takeCloseBracket:"]", prefix:true, infix:true, debugText:"square",
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs )
				return SWYM.NonCustomParseTreeNode(lhs, op, rhs);

			// passing an array to a function call
			var arrayNode = SWYM.NonCustomParseTreeNode(undefined, op, rhs);
			var result = {type:"fnnode", body:undefined, isDecl:undefined, name:undefined, children:[arrayNode], argNames:["__"]};
			return SWYM.CombineFnNodes(lhs, result);
		},
		customCompile:function(node, cscope, executable)
		{
			if( node.children[1] === undefined )
			{
				// empty list/table
				var emptyList = SWYM.jsArray([]);
				
				executable.push("#Literal");
				executable.push(emptyList);
				return {type:"swymObject", ofClass:SWYM.ArrayClass, outType:SWYM.NoValuesType, baked:emptyList};
			}
//			else if ( node.op.isParamBlock )
//			{
//				// json table
//				var memberNodes = {};
//				for( var Idx = 0; Idx < node.children[1].argNames.length; Idx++ )
//				{
//					memberNodes[node.children[1].argNames[Idx]] = node.children[1].children[Idx];
//				}
//
//				return SWYM.CompileJson(memberNodes, cscope, executable);
//			}
			else
			{
				// list expression
				var type = SWYM.CompileNode(node.children[1], cscope, executable);

				if( !type || type.multivalueOf === undefined )
				{
					// wrap single values in a list
					executable.push( "#ToMultivalue" );
				}
				return SWYM.ArrayTypeContaining(type);
			}
		}
	},
	"{": { precedence:330, takeCloseBracket:"}", prefix:true, infix:true, debugText:"curly",
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs )
				return SWYM.NonCustomParseTreeNode(lhs, op, rhs);

			// function call
			if( lhs && (lhs.type === "decl" || (lhs.type === "fnnode" && lhs.isDecl)) )
			{
				// something like  'fn'('x') {...}  or  String.'fn' {...}  - this is the body of the function.
				var result = {type:"fnnode", body:rhs, isDecl:undefined, name:undefined, children:[], argNames:[]};
			}
			else
			{
				// something like fn{...} - this is a block being passed as a function argument
				var lambdaNode = SWYM.NonCustomParseTreeNode(undefined, op, rhs);
				var result = {type:"fnnode", body:undefined, isDecl:undefined, name:undefined, children:[lambdaNode], argNames:["__"]};
			}
			
			return SWYM.CombineFnNodes(lhs, result);
		},
		customCompile:function(node, cscope, executable)
		{
			// either a lambda function, or a table
			if( SWYM.IsTableNode(node.children[1]) )
				return SWYM.CompileTable(node.children[1], cscope, executable);
			else
				return SWYM.CompileLambda(node, node.op.argName, cscope, executable);
		}
	},

	// this isn't really an operator, it's just here so the tokenizer can complain about it.
	"{-": { precedence:330, takeCloseBracket:"}", debugText:"curlyMinus" },

	")": { isCloseBracket:true },
	"]": { isCloseBracket:true },
	"}": { isCloseBracket:true },
	
	// lambda argument name (processed entirely within the tokenizer)
	"->": { precedence:1000, infix:true },

	// this is the operator that string interpolations generate
	"(str++)": {precedence:1000, returnType:SWYM.StringType, infix:function(a,b){return SWYM.StringWrapper(a.data+b.data)} }
};

//==================================================================================

SWYM.OneExpectedArg = { "this":{index:0} };
SWYM.TwoExpectedArgs = { "this":{index:0}, "that":{index:1} };

SWYM.DefaultGlobalCScope =
{
	"true": SWYM.BakedValue(true),
	"false": SWYM.BakedValue(false),
	"void": SWYM.BakedValue(null),
	
	"Callable": SWYM.BakedValue(SWYM.CallableType),
	"Type": SWYM.BakedValue(SWYM.TypeType),
	"Table": SWYM.BakedValue(SWYM.TableType),
	"Array": SWYM.BakedValue(SWYM.ArrayType),
	"String": SWYM.BakedValue(SWYM.StringType),
	"Block": SWYM.BakedValue(SWYM.BlockType),
	"Bool": SWYM.BakedValue(SWYM.BoolType),
	"Number": SWYM.BakedValue(SWYM.NumberType),
	"Int": SWYM.BakedValue(SWYM.IntType),
	"Value": SWYM.BakedValue(SWYM.AnyType),

	// these two are redundant, they should be indistinguishable from a user's perspective. The only reason they're both here is for testing purposes.
	"novalues": {type:"type", multivalueOf:{type:"type", nativeType:"NoValues"}, baked:SWYM.jsArray([])},
	"value_novalues": SWYM.BakedValue(SWYM.value_novalues),
	
	"fn#+":
	[{
		expectedArgs:{ "this":{index:0, typeCheck:SWYM.NumberType}, "rhs":{index:1, typeCheck:SWYM.NumberType} },
		nativeCode:function(a,b){ return a+b; },
		getReturnType:function(argTypes){ return SWYM.TypeUnify( argTypes[0], argTypes[1] ); }
	},
/*	{
		expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType}, "rhs":{index:1, typeCheck:SWYM.ArrayType} },
		nativeCode:function(a,b){  return SWYM.Concat(a,b);  },
		getReturnType:function(argTypes){ return SWYM.ArrayTypeContaining(SWYM.TypeUnify(SWYM.GetOutType(argTypes[0]), SWYM.GetOutType(argTypes[1]))); }
	}*/],
	
	"fn#Struct":
	[{
		expectedArgs:{ "body":{index:0, typeCheck:SWYM.BlockType} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable)
		{
			if( !argTypes[0].baked && (!argTypes[0].needsCompiling || argTypes[0].needsCompiling.length !== 1) )
			{
				SWYM.LogError(0, "The body of the Class function must be known at compile time!");
				return undefined;
			}
			
			var innerCScope = object(cscope);
			var unusedExecutable = [];
			var defaultNodes = {};
			
			if( argTypes[0].baked )
			{
				var memberTypes = SWYM.CompileClassBody(argTypes[0].baked.bodyNode, innerCScope, defaultNodes);
			}
			else
			{
				var memberTypes = SWYM.CompileClassBody(argTypes[0].needsCompiling[0].bodyNode, innerCScope, defaultNodes);
			}
			
			var newStruct = {type:"type", nativeType:"Struct", memberTypes:memberTypes};
			var targetCScope = SWYM.MainCScope !== undefined? SWYM.MainCScope: SWYM.DefaultGlobalCScope;
			
			for( var memberName in memberTypes )
			{
				if( memberTypes.hasOwnProperty(memberName) )
				{
					// declare a member accessor function
					SWYM.DeclareAccessor(memberName, newStruct, memberTypes[memberName], targetCScope);
				}
			}
			
			executable.push("#Literal");
			executable.push(newStruct);

			SWYM.DeclareNew(newStruct, defaultNodes, targetCScope);//SWYM.DefaultGlobalCScope);
						
			return SWYM.BakedValue(newStruct);
		}
	}],
		
/*	"fn#enum":
	[{
		expectedArgs:{ "this":{index:0, typeCheck:SWYM.TableType} },
		customCompile:function(argTypes, cscope, executable)
		{
			for( var memberName in argTypes[0].memberTypes )
			{
				SWYM.CompileFunctionDeclaration(
					"fn#"+memberName,
					{"this":{/*node* /}},
					{type:"fncall", name:"enumAt", args:{"this":SWYM.NewToken("name", 0, "this"), "that":SWYM.NewToken("literal", 0, memberName, memberName)}},
					cscope,
					executable
				);
			}
			
			return {type:"jsArray", memberTypes:argTypes[0].memberTypes, classType:SWYM.DefaultGlobalCScope.Namespace};
		},
		nativeCode:function(table)
		{
			return {type:"swymObject", classType:SWYM.DefaultGlobalCScope.Namespace, data:table.data};
		}
	}],

	"fn#enumAt":
	[{
		expectedArgs:{ "this":{index:0, typeCheck:{type:"swymObject"}}, "that":{index:1, typeCheck:SWYM.StringType} },
		returnType:{template:["@ArgTypeNamed",0,"@ArgTypeNamed",1,"@NamespaceMemberType"]},
		nativeCode:function(obj, name)
		{
			return obj.data[name];
		}
	}],
	
	"fn#mutableList":
	[{
		expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		returnType:{type:"swymObject", classType:SWYM.ArrayClass, elementType:{type:"variable"}, template:["@ArgTypeNamed",0,"@ElementType","@ToVariable","@ToArray"]},
		nativeCode:function(array)
		{
			var overrides = [];
			return {type:"jsArray", length:array.length, at:function(idx){return {type:"variable",
					getter:function(){ var v = overrides[idx]; if(v === undefined) return array.at(idx); else return v;},
					setter:function(v){overrides[idx] = v}
				}}}
		}
	}],

	"fn#extend":
	[{
		expectedArgs:{ "this":{index:0, typeCheck:SWYM.ClassType}, "that":{index:1, typeCheck:SWYM.TableType} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable)
		{
			var cls = argTypes[0]? argTypes[0].baked: undefined;
			var table = argTypes[1]? argTypes[1].baked: undefined;
			if( !cls || !table )
			{
				SWYM.LogError(0, "Arguments to the 'extends' function must be determinable at compile time!");
				return {type:"swymClass"};
			}
			else
			{
				var classID = SWYM.NextClassID;
				SWYM.NextClassID++;
				
				for( var memberName in table.data )
				{
					SWYM.CompileFunctionDeclaration(
						"fn#"+memberName,
						{"this":{type:"swymObject", classID:classID}},//class
						{type:"fncall", name:"getMember", args:{"this":SWYM.NewToken("name", 0, "this"), "that":SWYM.NewToken("literal", 0, memberName, memberName)}},
						cscope,
						executable
					);
				}
				
				var subclass = SWYM.MakeSubclass(classID, cls, table.data);
				
				executable.push("#Literal");
				executable.push(subclass);

				return {type:"swymClass", baked:subclass};
			}
		}
	}],
	
	"fn#internalNew":
	[{
		expectedArgs:SWYM.TwoExpectedArgs,
		returnType:{template:["@ArgTypeNamed",0,"@BakedTypeValue"]},
		nativeCode:function(cls, members)
		{
			if( !cls.memberTypes )
				SWYM.LogError(0, "new command failed - type unknown at compile time");
			else if( !SWYM.TableMatches(members.data, cls.memberTypes) )
				SWYM.LogError(0, "new command failed - type mismatch");
			
			return {type:"swymObject", classType:cls, members:members.data};
		}
	},
	{
		expectedArgs:{ "this":{index:0, typeCheck:SWYM.TableType}, "at":{index:1, typeCheck:SWYM.CallableType}, "members":{index:2}},//, typeCheck:{type:"swymObject", classType:SWYM.TableClass}} },
		returnType:{template:["@ArgTypeNamed",0,"@BakedTypeValue","@ArgTypeNamed",1,"@UseForElementType"]},
		nativeCode:function(cls, atFunction, members)
		{
			if( !cls.memberTypes )
				SWYM.LogError(0, "new command failed - type unknown at compile time");
			else if( !SWYM.TableMatches(members.data, cls.memberTypes) )
				SWYM.LogError(0, "new command failed - type mismatch");
			
			return {type:"swymObject", classType:cls, members:members.data, at:function(idx){return SWYM.ForceSingleValue( SWYM.ClosureCall(atFunction,idx) )} };
		}
	}],
	
	"fn#getMember":
	[{
		expectedArgs:{ "this":{index:0, typeCheck:SWYM.ObjectType}, "that":{index:1, typeCheck:SWYM.StringType} },
		returnType:{template:["@ArgTypeNamed",0,"@ArgTypeNamed",1,"@MemberType"]},
		nativeCode:function(obj, name)
		{
			return obj.members[ SWYM.ToTerseString(name) ];
		}
	}],*/
	
	"fn#Subtype":
	[{
		expectedArgs:{
			"this":{index:0, typeCheck:SWYM.TypeType},
			"test":{index:1, typeCheck:SWYM.CallableType}
		},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, argExecutables)
		{
			if( !argTypes[0] || !argTypes[0].baked || !argTypes[0].baked.describesType )
			{
				SWYM.LogError(0, "Calling Subtype: BaseType was not a compile-time type!");
				return undefined;
			}
			var baseTypeValue = argTypes[0].baked;
			var condType = SWYM.GetOutType(argTypes[1], baseTypeValue.describesType);
			SWYM.TypeCoerce(SWYM.BoolType, condType, "SubType");
			
			// at runtime, this just composes the two closures with an &&.
			SWYM.pushEach(argExecutables[0], executable);
			SWYM.pushEach(argExecutables[1], executable);
			executable.push("#Native");
			executable.push(2);
			executable.push(function(a,b)
			{
				return {type:"closure", run:function(v)
				{
					return SWYM.ClosureCall(a,v) && SWYM.ClosureCall(b,v);
				}}
			});
			
			var newClassID = "SubType_"+SWYM.NextClassID + "_ID";
			SWYM.NextClassID++;

			var newClassIDs = object(baseTypeValue.describesType.ofClass.classIDs);
			newClassIDs[newClassID] = true;

			var newClass = {type:"swymObject", ofClass:SWYM.TypeClass,
					baseClass:baseTypeValue.describesType.ofClass,
					classID:newClassID,
					classIDs:newClassIDs};
			var newType = {type:"swymObject", ofClass:newClass};
			newClass.describesType = newType;
			
			return {type:"swymObject", ofClass:SWYM.TypeClass, outType:SWYM.BoolType, baked:newClass};
		}
	}],
	
	"fn#if":
	[{
		expectedArgs:{
			"this":{index:0},
			"test":{index:1, typeCheck:SWYM.CallableType},
			"then":{index:2, typeCheck:SWYM.CallableType},
			"else":{index:3, typeCheck:SWYM.CallableType}
		},
		customCompile:function(argTypes, cscope, executable)
		{
			var isMulti = argTypes[0].multivalueOf !== undefined || argTypes[1].multivalueOf !== undefined || 
						argTypes[2].multivalueOf !== undefined || argTypes[3].multivalueOf !== undefined;
			
			var selfType = SWYM.ToSinglevalueType(argTypes[0]);
			var condType = SWYM.GetOutType(SWYM.ToSinglevalueType(argTypes[1]), selfType);
			
			var bodyType = selfType;
			if( argTypes[1] && argTypes[1].baked && argTypes[1].baked.type === "type" )
			{
				bodyType = SWYM.TypeIntersect(selfType, argTypes[1].baked);
			}
			var thenType = SWYM.GetOutType(SWYM.ToSinglevalueType(argTypes[2]), bodyType);
			
			// TODO: do some kind of type-subtract so we can pass selfType minus bodyType in here.
			var elseType = SWYM.GetOutType(SWYM.ToSinglevalueType(argTypes[3]), selfType);
			SWYM.TypeCoerce(SWYM.BoolType, condType, "if");
			
			// optimizations needed -
			// 1) don't bother to use self at all, if the blocks don't use it
			// 2) bake these switches in at compile time:
			var condToSingle = false;
			var thenToMulti = false;
			var elseToMulti = false;
		
			if( condType && condType.multivalueOf !== undefined )
			{
				var condToSingle = true;
			}
		
			// if thenType is a multivalue and elseType isn't, multify elseType. And vice versa.
			if( thenType && thenType.multivalueOf !== undefined && (!elseType || elseType.multivalueOf === undefined) )
			{
				var elseToMulti = true;
				elseType = SWYM.ToMultivalueType(elseType);
			}
			else if( elseType && elseType.multivalueOf !== undefined && (!thenType || thenType.multivalueOf === undefined) )
			{
				var thenToMulti = true;
				thenType = SWYM.ToMultivalueType(thenType);
			}

			executable.push(isMulti? "#MultiNative": "#Native");
			executable.push(4);
			executable.push(function(self, test, then, els)
			{
				var cond = SWYM.ClosureCall(test, self);
				if( condToSingle )
				{
					cond = SWYM.ForceSingleValue(cond);
				}
				
				if( cond === false )
				{
					if( elseToMulti )
						return SWYM.jsArray([SWYM.ClosureCall(els, self)]);
					else
						return SWYM.ClosureCall(els, self);
				}
				else
				{
					if( thenToMulti )
						return SWYM.jsArray([SWYM.ClosureCall(then, self)]);
					else
						return SWYM.ClosureCall(then, self);
				}
			});

			return SWYM.TypeUnify(thenType, elseType);
		}
	}/*,
	{
		expectedArgs:{ "__rhs":{index:0, typeCheck:{type:"bool"}}, "__":{index:1} },
		customCompile:function(argTypes, cscope, executable) { return {multivalue:true}; },
		multiCustomCompile:function(argTypes, cscope, executable) { return {multivalue:true}; },
		nativeCode:function(cond, then)
		{
			if( cond === false )
				return null;
			else
				return SWYM.ClosureCall(then);
		}
	}*/],

	"fn#output":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.StringType} },
			returnType:SWYM.VoidType,
			customCompile:function(argTypes, cscope, executable)
			{
				executable.push("#Native", 1, function(value)
				{
					// if the program contains an explicit output statement, don't do an implicit one.
					SWYM.doFinalOutput = false;
					SWYM.DisplayOutput(value.data)
				});
			}
		}],

	"fn#input":[{  expectedArgs:{ "this":{index:0} },
			returnType:SWYM.StringType,
			nativeCode:function(promptStr){ var result = prompt(SWYM.ToTerseString(promptStr), ""); return (result === null)? SWYM.StringWrapper(""): SWYM.StringWrapper(result); }
		},
		{  expectedArgs:{ "that":{index:0}, "else":{index:1} },
			returnType:SWYM.StringType,
			nativeCode:function(promptStr, elseFn){ var result = prompt(SWYM.ToTerseString(promptStr), ""); return (result === null)? SWYM.ClosureCall(elseFn): SWYM.jsArray([SWYM.StringWrapper(result)]); }
		},
		{  expectedArgs:{ "prompt":{index:0}, "default":{index:1} },
			returnType:SWYM.StringType,
			nativeCode:function(promptStr, defaultStr){ var result = prompt(SWYM.ToTerseString(promptStr), SWYM.ToTerseString(defaultStr)); return (result === null)? SWYM.StringWrapper(""): SWYM.StringWrapper(result); }
		},
		{  expectedArgs:{ "prompt":{index:0}, "default":{index:1}, "else":{index:2} },
			nativeCode:function(promptStr, defaultStr, elseFn)
			{
				var result = prompt(SWYM.ToTerseString(promptStr), SWYM.ToTerseString(defaultStr));
				return (result === null)? SWYM.ClosureCall(elseFn): SWYM.jsArray([SWYM.StringWrapper(result)]);
			},
			getReturnType:function(argTypes)
			{
				return SWYM.TypeUnify( SWYM.StringType, SWYM.GetOutType(argTypes[2], SWYM.VoidType) );
			}
		}],

	"fn#alert":[{  expectedArgs:{ "this":{index:0} },
			returnType:SWYM.VoidType,
			nativeCode:function(alertStr){ alert(SWYM.ToTerseString(alertStr), ""); }
		}],

	"fn#length":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
			returnType:SWYM.IntType,
			nativeCode:function(value){  return value.length;  } 
		}],

	"fn#sqrt":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.NumberType} },
			returnType:SWYM.NumberType,
			nativeCode:function(value){  return Math.sqrt(value);  }
		}],
		
	"fn#cos":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.NumberType} },
			returnType:SWYM.NumberType,
			nativeCode:function(value){  return Math.cos(value);  }
		}],

	"fn#sin":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.NumberType} },
			returnType:SWYM.NumberType,
			nativeCode:function(value){  return Math.sin(value);  }
		}],

	"fn#floor":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.NumberType} },
			returnType:SWYM.NumberType,
			nativeCode:function(value){  return Math.floor(value);  }
		}],

	"fn#ceiling":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.NumberType} },
			returnType:SWYM.NumberType,
			nativeCode:function(value){  return Math.ceil(value);  }
		}],

	"fn#var":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.TypeType}, "init":{index:1} },
			customCompileWithoutArgs:true,
			customCompile:function(argTypes, cscope, executable, argExecutables)
			{
				if ( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
				{
					SWYM.LogError(0, "");
					return SWYM.VariableTypeContaining(SWYM.ValueType);
				}
				else
				{
					var varType = argTypes[0].baked;
					SWYM.TypeCoerce(varType, argTypes[1]);

					SWYM.pushEach(argExecutables[1], executable);
					executable.push("#Native");
					executable.push(1);
					executable.push(function(v){return {type:"variable", value:v}});

					return SWYM.VariableTypeContaining(varType);
				}
			}
		}],

	"fn#value":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.VariableType} },
			customCompile:function(argTypes, cscope, executable)
			{
				executable.push("#VariableContents");
				return SWYM.GetVariableTypeContents(argTypes[0]);
			}
		}],

	"fn#ref":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.VariableType} },
		returnType:{type:"variable", template:["@ArgTypeNamed",0,"@Ref"]},
		customCompile:function(argTypes, cscope, executable) {} // no-op!
	}],
	
	"fn#random":[{  expectedArgs:{ "this":{index:0} },
		getReturnType:function(argTypes)
		{
			return SWYM.GetOutType(argTypes[0], SWYM.IntType);
		},
		nativeCode:function(array)
		{
			var randomIndex = Math.floor(Math.random() * array.length);
			return array[randomIndex];
		}
	}],

	"fn#do":[{  expectedArgs:{ "this":{index:0}, "fn":{index:1, typeCheck:SWYM.CallableType}},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, argExecutables)
		{
			var returnType = SWYM.GetOutType( argTypes[1], argTypes[0] );
			SWYM.CompileClosureCall(argTypes[0], argExecutables[0], argTypes[1], argExecutables[1], cscope, executable);
			return returnType;
		},
		multiCustomCompile:function(argTypes, cscope, executable, argExecutables)
		{
			for( var Idx = 0; Idx < argExecutables.length; ++Idx )
			{
				SWYM.pushEach(argExecutables[Idx], executable);
				if( !argTypes[Idx] || argTypes[Idx].multivalueOf === undefined )
				{
					executable.push("#ToMultivalue");
				}
			}
			executable.push("#MultiClosureCall");
			return SWYM.GetOutType( SWYM.ToSinglevalueType(argTypes[1]), SWYM.ToSinglevalueType(argTypes[0]) );
		}
	},
	{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.CallableType} },
		returnType:SWYM.VoidType,
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, argExecutables)
		{
			var returnType = SWYM.GetOutType( argTypes[0], SWYM.VoidType );
			SWYM.CompileClosureCall(SWYM.VoidType, ["#Literal", undefined], argTypes[0], argExecutables[0], cscope, executable);
			return returnType;
		},
		multiCustomCompile:function(argTypes, cscope, executable, argExecutables)
		{
			executable.push("#Literal");
			var undefArray = [undefined];
			undefArray.type = "jsArray";
			undefArray.run = function(idx){ return this[idx]; };
			executable.push(undefArray);

			SWYM.pushEach(argExecutables[0], executable);

			executable.push("#MultiClosureCall");
			return SWYM.GetOutType( argTypes[0], SWYM.VoidType );
		}
	}],

	"fn#each":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable) { return SWYM.ToMultivalueType(SWYM.GetOutType(argTypes[0])); }, // each is basically a no-op!
		multiCustomCompile:function(argTypes, cscope, executable)
		{
//      executable.push("#Flatten");
      return SWYM.ToMultivalueType(SWYM.GetOutType(SWYM.ToSinglevalueType(argTypes[0])));
    }
	}],
	
	"fn#accumulate":[
	{
		expectedArgs:{ 
			"this":{index:0},
			"array":{index:1, typeCheck:SWYM.ArrayType}, 
			"body":{index:2, typeCheck:SWYM.CallableType}
		},
		customCompile:function(argTypes, cscope, executable)
		{
			var outType = SWYM.GetOutType(argTypes[2], SWYM.ArrayTypeContaining(argTypes[0]));
			
			executable.push("#Native");
			executable.push(3);
			
			if( !outType || outType.multivalueOf !== undefined )
			{
				executable.push(function(start, array, body)
				{
					var current = start;
					for( var Idx = 0; Idx < array.length; Idx++ )
					{
						current = SWYM.ClosureCall(body, SWYM.jsArray([current, array.run(Idx)]));
					}
					return current;
				});
			}
			else
			{
				executable.push(function(start, array, body)
				{
					var current = SWYM.jsArray([start]);
					for( var Idx = 0; Idx < array.length; Idx++ )
					{
						current = SWYM.Flatten( SWYM.ForEachPairing([current, SWYM.jsArray([array.run(Idx)])], function(args)
						{
							return SWYM.ClosureCall(body, SWYM.jsArray([args[0], args[1]]));
						}));
					}
					return current;
				});
			}
			
			return outType;
		}
	}],

	"fn#reduce":[
	{
		expectedArgs:{ 
			"this":{index:0},
			"body":{index:1, typeCheck:SWYM.CallableType}
		},
		customCompile:function(argTypes, cscope, executable)
		{
			var outType = SWYM.GetOutType(argTypes[1], argTypes[0]);
			
			executable.push("#Native");
			executable.push(2);
			
			if( outType && outType.multivalueOf !== undefined )
			{
				SWYM.LogError(0, "reduce's 'body' argument must return single values.");
			}
			else
			{
				executable.push(function(array, body)
				{
					var current = array.run(0);
					for( var Idx = 1; Idx < array.length; Idx++ )
					{
						current = SWYM.ClosureCall(body, SWYM.jsArray([current, array.run(Idx)]));
					}
					return current;
				});
			}
			
			return outType;
		}
	}],
	
	"fn#array":[{  expectedArgs:{
			"length":{index:0, typeCheck:SWYM.IntType},
			"at":{index:1, typeCheck:SWYM.CallableType}
			//"__default":{index:0, typeCheck:{type:"union", subTypes:[{type:"jsArray"}, {type:"string"}, {type:"json"}]}}, "__rhs":{index:1, typeCheck:{type:"union", subTypes:[{type:"string"}, {type:"number"}]}}
		},
		customCompile:function(argTypes, cscope, executable)
		{
			var elementType = SWYM.GetOutType(argTypes[1], SWYM.IntType);
			executable.push("#Native");
			executable.push(2);
			if( elementType && elementType.multivalueOf !== undefined )
			{
				SWYM.LogError(0, "Invalid array constructor - element type cannot be a multivalue");
			}
			else
			{
				executable.push(function(len, lookup)
				{
					return {
						type:"jsArray",
						length:len,
						run:function(key) {return SWYM.ClosureCall(lookup,key);}
					};
				});
			}
			return SWYM.ArrayTypeContaining(elementType);
		}
	}],

	"fn#Array":[{  expectedArgs:{
			"this":{index:0, typeCheck:SWYM.TypeType},
		},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, argExecutables)
		{
			if( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
			{
				SWYM.LogError(0, "Argument to the Array function is not a valid type expression!");
				return SWYM.NoValuesType;
			}
			return SWYM.BakedValue(SWYM.ArrayTypeContaining(argTypes[0].baked));
		}
	}],
	
	"fn#Literal":[{ expectedArgs:{
			"this":{index:0, typeCheck:SWYM.TypeType},
		},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, argExecutables)
		{
			if( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
			{
				SWYM.LogError(0, "Argument to the Static function is not a valid type expression!");
				return SWYM.NoValuesType;
			}
			return SWYM.BakedValue(argTypes[0]);
		}
	}],
		
	
	"fn#distinct":[{
		expectedArgs:{"this":{index:0, typeCheck:SWYM.ArrayType} },
		nativeCode:SWYM.Distinct,
		getReturnType:function(argTypes, cscope) { return argTypes[0]; }
	}],

	"fn#table":[{
		expectedArgs:{
			"keys":{index:0, typeCheck:SWYM.ArrayType}, "body":{index:1, typeCheck:SWYM.CallableType}
			//"__default":{index:0, typeCheck:{type:"union", subTypes:[{type:"jsArray"}, {type:"string"}, {type:"json"}]}}, "__rhs":{index:1, typeCheck:{type:"union", subTypes:[{type:"string"}, {type:"number"}]}}
		},
		nativeCode:function(keys, lookup)
		{
			return {type:"table", keys:SWYM.Distinct(keys), run:function(key){return SWYM.ClosureCall(lookup,key)} }
		},
		getReturnType:function(argTypes, cscope)
		{
			var keyType = SWYM.GetOutType(argTypes[0], SWYM.IntType);
			var valueType = SWYM.GetOutType(argTypes[1], keyType);
			
			return {type:"swymObject", ofClass:SWYM.TableClass, argType:keyType, outType:valueType};
		}
	}],
	
	"fn#keys":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.TableType} },
		customCompile:function(argTypes, cscope, executable)
		{
			executable.push("#Native");
			executable.push(1);
			executable.push(function(table)
			{
				if( table.keys )
				{
					return table.keys;
				}
				else if( table.length )
				{
					return SWYM.rangeArray(0, table.length);
				}
				else
				{
					SWYM.LogError(0, "Fsckup: no keys defined for this object");
					return SWYM.jsArray([]);
				}
			});
			
			if( argTypes[0] && argTypes[0].memberTypes && argTypes[0].memberTypes.keys !== undefined )
			{
				return argTypes[0].memberTypes.keys;
			}
			else if( argTypes[0] && argTypes[0].memberTypes && argTypes[0].memberTypes.length !== undefined )
			{
				return SWYM.IntArrayType;
			}
			else
			{
				return SWYM.ArrayType;
			}
		}
	}],
	
  "fn#values":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.EnumType} },
		customCompile:function(argTypes, cscope, executable)
		{
      if( !argTypes[0] || !argTypes[0].baked || !argTypes[0].baked.enumValues )
      {
        SWYM.LogError(0, "Fsckup: Enum values must be known at compile time!?");
      }
			executable.push("#Literal");
			executable.push(argTypes[0].baked.enumValues);
			return SWYM.ArrayTypeContaining(argTypes[0].baked);
		}
	}],
	
	"fn#lowercase":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.StringType} },
		returnType:SWYM.StringType,
		nativeCode:function(str)
		{
			return SWYM.StringWrapper( str.data.toLowerCase() );
		}
	}],

	"fn#uppercase":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.StringType} },
		returnType:SWYM.StringType,
		nativeCode:function(str)
		{
			return SWYM.StringWrapper( str.data.toUpperCase() );
		}
	}],

	"fn#sortedBy":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType}, "body":{index:1, typeCheck:SWYM.BlockType} },
		returnType:SWYM.ArrayType,
		nativeCode:function(array, body)
		{
			
		}
	}],

	"fn#while":[{ expectedArgs:{ "test":{index:0, typeCheck:SWYM.CallableType}, "body":{index:1, typeCheck:SWYM.CallableType} },
		returnType:SWYM.VoidType,
		customCompile:function(argTypes, cscope, executable)
		{
			executable.push("#Native");
			executable.push(1);
			executable.push(function(body)
			{
				return SWYM.ClosureCall(body, undefined);
			});

			return SWYM.GetOutType(argTypes[0], SWYM.VoidType);

		}
	}],
}

SWYM.stdlyb =
"\
//Swym loads this library by default, to implement various useful Swym constants\n\
//and functions.  NB: some built-in native functions (such as 'input', 'output',\n\
//'random', 'length', 'do', 'each', 'sin', 'cos', 'sqrt', 'floor', 'array', etc)\n\
//plus a few special constants that cannot be bootstrapped ('true', 'false' and\n\
//'novalues'), are not defined here.\n\
Array.'+'('arr':Array) = [.each, arr.each];\
Array.'atEnd'('idx') {.at(.length-1-idx)};\
Array.'#st' {.at(#-1)};\
Array.'#nd' {.at(#-1)};\
Array.'#rd' {.at(#-1)};\
Array.'#th' {.at(#-1)};\
Table.'at'('key') = key.(this);\
Table.'at'('key','else') = .if{ key.in(.keys) }{ .at(key) } else (else);\
Array.'at'('key','else') = .if{key >=0 && key < .length}{.at(key)} else (else);\
Array.'atEach'('keys':Int.Array) = [ keys.each.if{>=0 && it<this.length}.(this) ];\
Array.'#st'('else') {.at(#-1) else(else)};\
Array.'#nd'('else') {.at(#-1) else(else)};\
Array.'#rd'('else') {.at(#-1) else(else)};\
Array.'#th'('else') {.at(#-1) else(else)};\
Array.'#stLast' {.atEnd(#-1)};\
Array.'#ndLast' {.atEnd(#-1)};\
Array.'#rdLast' {.atEnd(#-1)};\
Array.'#thLast' {.atEnd(#-1)};\
Array.'last' = .atEnd(0);\
Value.'box' = [this];\
'pair'('a')('b') = [a,b];\
Value.'of' = this;\
'for'('v')('fn') = v.(fn);\
Value.'is'('fn') = .(fn);\
Value.'print' = output($this);\
Value.'println' = output(\"$this\\n\");\
Value.'trace' = output(\"$$this\\n\");\
Array.'flatten' = [ .each.each ];\
'Cell' = Struct{'key','context'};\
Cell.'value' = .key.(.context);\
Table.'cells' = array(.keys.length) 'key'->{ Cell.new(this.keys.at(key), this) };\
Cell.Array.'table' = table[.each.key](.1st.context);\
Cell.Array.'cellKeys' = [.each.key];\
Cell.Array.'cellValues' = [.each.value];\
'forEach'('list')('fn') = [ list.each.(fn) ];\
'forEach_lazy'('list')('fn') = array(length:.length){ list.at(it).(fn) };\
'if'('cond':Bool, 'then', 'else') = 404.if{ cond }{ do(then) } else { do(else) };\
'if'('cond':Bool, 'then') = 404.if{ cond }{ do(then) } else {};\
Value.'if'('test':Callable, 'then') = .if(test)(then) else {it};\
Value.'if'('test':Callable, 'else') = .if(test){it} else (else);\
Value.'if'('test':Callable) = .if(test){it} else {novalues};\
Array.'contains'('test':Block) = .1st.(test) || .2nd.(test) || etc;\
Array.'where'('test') = forEach(this){ .if(test) };\
Array.'where'('test')('body') = forEach(this){ .if(test)(body) else {novalues}  };\
Array.'where'('test', 'body', 'else') = forEach(this){ .if(test)(body) else (else) };\
Array.'whereKey'('test') = forEach(.keys){ .if(test)(this) else {novalues} };\
Array.'whereKey'('test', 'body') = forEach(.keys){ .if(test){.(this).(body)} else {novalues} };\
Array.'whereKey'('test', 'body', 'else') = forEach(.keys){ .if(test){.(this).(body)} else {.(this).(else)} };\
Array.'some'('test') = .1st.(test) || .2nd.(test) || etc;\
Array.'every'('test') = .1st.(test) && .2nd.(test) && etc;\
Array.'none'('test') = !.some(test);\
Array.'every' = .1st && .2nd && etc;\
Array.'some' = .1st || .2nd || etc;\
Array.'none' = !(.1st || .2nd || etc);\
'some'('list')('test') = list.some(test);\
'every'('list')('test') = list.every(test);\
'no'('list')('test') = !list.some(test);\
'none'('list')('test') = !list.some(test);\
Array.'starting'('n':Int) = .atEach[0..<n];\
Array.'ending'('n':Int) = .atEach[ (.length-n).clamp(min:0) ..< .length];\
Array.'slice'('start':Int) = .atEach[start ..< .length];\
Array.'slice'('length':Int) = .atEach[0..<length];\
Array.'slice'('end':Int) = .atEach[0..<end];\
Array.'slice'('last':Int) = .atEach[0..last];\
Array.'slice'('trimEnd':Int) = .atEach[0 ..< .length-trimEnd];\
Array.'slice'('start':Int,'end':Int) = .atEach[start..<end];\
Array.'slice'('start':Int,'last':Int) = .atEach[start..last];\
Array.'slice'('start':Int,'length':Int) = .atEach[start..<start+length];\
Array.'slice'('length':Int,'end':Int) = .atEach[end-length..<end];\
Array.'slice'('length':Int, 'last':Int) = .atEach[last-length-1..last];\
Array.'slice'('start':Int,'trimEnd':Int) = .atEach[start ..< .length-trimEnd];\
Array.'slice'('length':Int,'trimEnd':Int) = .atEach[.length-length-fromEnd ..< .length-trimEnd];\
Array.'trimStart'('n':Int) = .atEach[n ..< .length];\
Array.'trimEnd'('n':Int) = .atEach[0 ..< .length-n];\
Array.'startsWith'('list':Array) = .length >= list.length && .starting(list.length) == list;\
Array.'endsWith'('list':Array) = .length >= list.length && .ending(list.length) == list;\
Array.'splitAt'('n':Int) = [ .slice(end:n), .slice(start:n) ];\
Array.'splitAt'('keys':Int.Array) = [0, keys.each, .length].{[this.slice(start:.1st, end:.2nd), this.slice(start:.2nd, end:.3rd), etc]};\
Array.'splitWhere'('test':Callable) = .splitAt[key~of~each(.cells.where{.value.(test)})];\
Array.'splitOut'('keys':Int.Array) = [0, keys.each, .length].{[this.slice(start:.1st+1, end:.2nd), this.slice(start:.2nd+2, end:.3rd)]};\
Array.'splitOutWhere'('test':Callable) = .splitOut[key~of~each(.cells.where{.value.(test)})];\
Array.'splitAtEnd'('n':Int) = [ .slice(trimEnd:n), .ending(n) ];\
Array.'tail' = .atEach[1 ..< .length];\
Array.'stem' = .atEach[0 ..< .length-1];\
Array.'middle' = .atEach[1 ..< .length-1];\
Array.'reversed' = .atEach[.length-1 .. 0];\
Array.'withBounds'('bound') = array(length:.length) 'key'->{ this.at(key) else (key.(bound)) };\
Array.'safeBounds' = .withBounds{novalues};\
Array.'cyclic' = .withBounds{ this.at( it%this.length ) };\
Array.'total' = .1st + .2nd + etc;\
Array.'sum' = .total;\
Array.'product' = .1st * .2nd * etc;\
Value.'in'('array') { ==any array };\
Number.'clamp'('min':Number) = if(this < min){ min } else { this };\
Number.'clamp'('max':Number) = if(this > max){ max } else { this };\
Number.'clamp'('min':Number, 'max':Number) = .clamp(min:min).clamp(max:max);\
Array.'min' = .reduce ['a','b']-> { a.clamp(max:b) };\
Array.'min'('else') = if(.length>0){this.min} else (else);\
Array.'max' = .reduce ['a','b']-> { a.clamp(min:b) };\
Array.'min'('property') = .reduce ['a','b']-> { if(a.(property) <= b.(property)){a} else {b} };\
Array.'max'('property') = .reduce ['a','b']-> { if(a.(property) >= b.(property)){a} else {b} };\
Array.'whereMin' = [.each.box].reduce['a','b'] -> { if(a == []){ b } else if(b == []){ a } else if(a.1st > b.1st){ b } else if(a.1st < b.1st){ a } else { a+b } };\
Array.'whereMax' = [.each.box].reduce['a','b'] -> { if(a == []){ b } else if(b == []){ a } else if(a.1st < b.1st){ b } else if(a.1st > b.1st){ a } else { a+b } };\
Array.'whereMin'('property') = [.each.box].reduce['a','b'] -> { if(a == []){ b } else if(b == []){ a } else if(a.1st.(property) > b.1st.(property)){ b } else if(a.1st.(property) < b.1st.(property)){ a } else { a+b } };\
Array.'whereMax'('property') = [.each.box].reduce['a','b'] -> { if(a == []){ b } else if(b == []){ a } else if(a.1st.(property) < b.1st.(property)){ b } else if(a.1st.(property) > b.1st.(property)){ a } else { a+b } };\
Array.'firstWhere'('test') = .each.if(test).{ return it };\
Array.'firstWhere'('test', 'else') { .each.if(test).{ return it }; return .(else) };\
Array.'firstWhere'('test', 'then', 'else') { .each.if(test).{ return .(then) }; return .(else) };\
Array.'firstWhereKey'('test') = .keys.each.if(test).{ return .(this) };\
Array.'firstWhereKey'('test', 'else') { .keys.each.if(test).{ return .(this) }; return .(else) };\
Number.'s_plural' = if(this==1) {\"\"} else {\"s\"};\
'var'('init') = Value.var(init);\
'Empty' = {.length == 0};\
'PI' = 3.1415926535897926;\
Block.'Non' = {!.(this)};\
Number.'neg' = -this;\
Number.'degToRad' = this*PI/180;\
Number.'radToDeg' = this*180/PI;\
Number.'abs' = if(this>=0){it} else { -this};\
Number.'differenceFrom'('n') = abs(this-n);\
String.'toInt' = .each.{\"0\":0, \"1\":1, \"2\":2, \"3\":3, \"4\":4, \"5\":5, \"6\":6, \"7\":7, \"8\":8, \"9\":9}.[].{ .1stLast*1 + .2ndLast*10 + .3rdLast*100 + etc };\
String.'lines' = .splitOutWhere{==\"\\n\"};\
String.'words' = .splitOutWhere{==any \" \\t\\n\"};\
Value.'case'('body':Table) = body.at(this);\
Array.'tabulate'('body') = table(this)(body);\
'case'('key')('body') = body.at(key);\n\
Array.'structElements'('idx')\n\
{\n\
  'curidx' = Number.var(idx);\
  forEach(this) 'template'->\n\
  {\n\
    yield template.at( curidx % template.length );\
    curidx = floor(curidx / template.length);\
  };\
};\n\
Array.Array.'Struct' = array(product[.each.length]) 'idx'->\n\
{\n\
  [ this.structElements(idx) ]\n\
};\
";/**/

/*
Array.'random'('length':Int) = [.random, etc**length]
Array.'randomDraw'('length':Int) = .randomSubset(length).shuffle
Array.'randomSubset'('length':Int) = .keys.trimEnd(length).random.'k'->{ [this.at(k)] + this.slice(start:k+1).randomSubset(length-1) }
Array.'randomRange'('length':Int) = .keys.trimEnd(length).random.'k'->{ this.atKeys[k ..< k+length] }
*/
/*
if( .contains(Non~Digit) )
{
  return 0;
}
else
{
  .reversed.forEach{ it-"0" }.call
  {
    .1st*1 + .2nd*10 + .3rd*100 + etc
  }
}*/

//'customTable'('at') { Table.internalNew(at:at, members:[]) }

SWYM.EvalStdlyb(SWYM.stdlyb);
result = SWYM.ReportErrors("Stdlyb Error");
//if ( result ) alert(result);
//SWYM.DefaultGlobalCScope = SWYM.scope;
