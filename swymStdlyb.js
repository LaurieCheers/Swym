//=================================================================================

SWYM.NextClassID = 8001;

// We have a big discrepancy between the (relatively simple) compile-time types,
// and the (fairly complex) run-time types. For example, at run-time we distinguish
// lazy evaluated lists from eagerly-evaluated ones; at compile time we don't.
// The .run functions are only used to identify whether a run-time object is valid.
// At compile time we require type IDs to tell us what is a subtype of what.
//
//             DontCare
//    +-----------+----------+
//  Void                  Anything
//          +----------------+---------+------+-------+-------+-------------+
//        Type            Container  Block  Number  Bool  <structinst> <enuminst>
//     +----+---+        +---+----+           |
// Struct      Enum    Array    Table        Int
//                       |
//                     String
//
// Interesting issue - do we need two root objects, one for callables and one for noncallables?
// Is Array a subtype of Table? They're basically compatible, except arrays renumber their keys; tables never do. :-/
// No, both are subtypes of Container.
// Is an array a struct? Are there any predefined struct types? Can structs be callable?
// How do we let arrays define their own "contains" or "random" methods?
// Is Bool an enum? Should the type Struct match struct types, or struct instances?
// Maybe StructType (and EnumType) should match struct types, and Struct should match all instances of all StructTypes.
// maybe defining Struct as a type at all would just cause confusion and be useless in practise.
// Can you say Bool.values (or the equivalent for any given enum) to get the list of possible values?
// Is every enum type actually an instance of a struct, to allow you to go "Color.RED" or whatever?
// Actually, that only requires a function Color.Literal.'RED' - no data storage required.
// Careful - that means any function you can call on all enums (such as .values), or on all types, will conflict
// with enum value names!
// That's a good reason to be careful with functions you can call on all types, yes. Enum elements
// do not conflict with it more than any other function name.
// A good reason to encourage enum value names to be all caps?
// Do we even have/want subtypes? What if we just do mixins for everything?

// predefined mixins: GreaterThan, GreaterThanOrEq, LessThan, LessThanOrEq, MultipleOf,
// Baked, Members, native_Number, native_String, native_Array, native_Table

// 'Type' = Anything->Bool & Baked & native_Type
// 'Array' = Number->auto & Members{ Int:'length' }
// 'StringChar' = Number->StringChar & Members{ 'length'=1 }
// 'String' = Number->StringChar & Members{ Nat:'length' }
// 'Table' = Callable & Members{ Array:'keys' }
// 'Block' = Callable & Members{ String:'text', ParseNode:'parsed' }
// 'Bool' = enum{ 'true'=true, 'false'=false }
// 'Int' = Number & MultipleOf(1)
// 'Nat' = Number & MultipleOf(1) & GreaterOrEq(0)
SWYM.initStdlyb = function() {

SWYM.AnyType = {type:"type", debugName:"Anything"};
SWYM.AnythingType = SWYM.AnyType;
SWYM.DontCareType = {type:"type", nativeType:"NoValues", debugName:"DontCare"};
SWYM.BoolType = {type:"type", enumValues:SWYM.jsArray([true, false]), debugName:"Bool"};
SWYM.MaybeFalseType = {type:"type", requireSomeBool:true, debugName:"MaybeFalse"};

SWYM.NumberType = {type:"type", nativeType:"Number", debugName:"Number"};
SWYM.IntType = {type:"type", nativeType:"Number", multipleOf:1, debugName:"Int"};
SWYM.BakedVoidType = {type:"type", nativeType:"Void", debugName:"Void", baked:null};
SWYM.VoidType = {type:"type", nativeType:"Void", debugName:"Void"};
SWYM.TypeType = {type:"type", nativeType:"Type", argType:SWYM.AnyType, outType:SWYM.BoolType, debugName:"Type"};

SWYM.IntArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.IntType, memberTypes:{"length":SWYM.IntType}, debugName:"Array(Int)"};
SWYM.IntArrayType.memberTypes["keys"] = SWYM.IntArrayType;

SWYM.StringCharType = {type:"type", nativeType:"String", isStringChar:true, argType:SWYM.IntType, memberTypes:{"length":SWYM.BakedValue(1), "keys":SWYM.IntArrayType, "isChar":SWYM.BakedValue(true)}, debugName:"StringChar"};
SWYM.StringCharType.outType = SWYM.StringCharType;

SWYM.VariableType = {type:"type", nativeType:"Variable", contentsType:SWYM.DontCareType, debugName:"Var"};

SWYM.NativeArrayType = {type:"type", nativeType:"JSArray", argType:SWYM.IntType, outType:SWYM.AnyType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"NativeArray"};
SWYM.NativeTableType = {type:"type", nativeType:"JSObject", argType:SWYM.StringType, outType:SWYM.AnyType, memberTypes:{"keys":SWYM.ArrayType}, debugName:"NativeTable"};
SWYM.NativeStringType = {type:"type", nativeType:"NativeString", argType:SWYM.IntType, outType:SWYM.StringCharType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"NativeString"};
SWYM.JSStringType = {type:"type", nativeType:"JSString", debugName:"JSString"};
SWYM.JSFunctionType = {type:"type", nativeType:"function", debugName:"jsfunction"};

SWYM.ArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.AnyType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"Array"};
SWYM.ContainerType = {type:"type", argType:SWYM.DontCareType, outType:SWYM.AnyType, memberTypes:{"keys":SWYM.ArrayType}, debugName:"Container"};
SWYM.TableType = {type:"type", argType:SWYM.DontCareType, outType:SWYM.AnyType, memberTypes:{"keys":SWYM.ArrayType}, debugName:"Table"};
SWYM.StringType = {type:"type", nativeType:"String", argType:SWYM.IntType, outType:SWYM.StringCharType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"String"};
SWYM.String1Type = SWYM.FixedLengthStringType(1);
SWYM.CallableType = {type:"type", nativeType:"Callable", argType:SWYM.DontCareType, outType:SWYM.AnyType, debugName:"Callable"};
SWYM.BlockType = {type:"type", argType:SWYM.DontCareType, outType:SWYM.AnyType, debugName:"Block"}; // will have members at some point
SWYM.PredicateType = {type:"type", argType:SWYM.AnyType, outType:SWYM.BoolType, debugName:"Predicate"};
SWYM.NumberArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.NumberType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"Number.Array"};
SWYM.StringArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.StringType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"String.Array"};
SWYM.StringCharArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.StringCharType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"StringChar.Array"};
SWYM.MutableArrayType = {type:"type", isMutable:true, argType:SWYM.IntType, outType:SWYM.AnyType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"MutableArray"};
SWYM.RangeArrayType = {type:"type", nativeType:"RangeArray", argType:SWYM.IntType, outType:SWYM.IntType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"RangeArray"};

SWYM.MultivalueRangeType = SWYM.ToMultivalueType(SWYM.IntType);
SWYM.MultivalueRangeType.nativeType = "RangeArray";

SWYM.operators = {
	"(blank_line)":  {precedence:1, infix:true, postfix:true, prefix:true, standalone:true, noImplicitSemicolon:true,
		identity:function(){ return [] },
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

	";":  {precedence:1, infix:true, postfix:true, noImplicitSemicolon:true,
		identity:function(){ return [] },
		customCompile:function(node, cscope, executable)
		{
			// optimized to reduce stack size, making stdlyb easier to debug
			var pending = [];
			var current;

			if( node.children[1] !== undefined ) 
			{
				pending.push(node.children[1]);
			}
			if( node.children[0] !== undefined ) 
			{
				pending.push(node.children[0]);
			}
			
			current = pending.pop();
			
			var returnType;

			while( current !== undefined )
			{
				if( current.op && current.op.text === ";" )
				{	
					if( current.children[1] !== undefined )
					{
						pending.push(current.children[1]);
					}
					current = current.children[0];
				}
				else
				{
					var oldLength = executable.length;
					returnType = SWYM.CompileNode(current, cscope, executable);

					if( executable.length > oldLength && executable[executable.length-1] !== "#ClearStack" &&
						pending.length > 0 )
					{
						executable.push( "#ClearStack" );
					}
					
					current = pending.pop();
				}
			}
			
			return returnType;
		}
	},

	"yield": {precedence:10, prefix:true,
		customCompile:function(node, cscope, executable)
		{
			var parentFunction = cscope["<withinFunction>"];
			if( !parentFunction )
			{
				SWYM.LogError(node, "Illegal yield - cannot yield when there's no enclosing function!");
				return undefined;
			}
			
			parentFunction.yields = true;

			//FIXME: these are actually incorrect, but I'm not sure how to fix it yet. Recursive function calls are tricky.
			var baseReturnType = SWYM.ToMultivalueType(SWYM.DontCareType);
			parentFunction.returnType = baseReturnType;
			parentFunction.bodyCScope["Yielded"] = baseReturnType;

			SWYM.pushEach(["#Load", "Yielded"], executable);
						
			var yieldType = SWYM.CompileNode(node.children[1], cscope, executable);
			if( !yieldType || yieldType.multivalueOf === undefined )
			{
				executable.push("#SingletonArray");
			}

			SWYM.pushEach(["#ConcatArrays", 2, "#Overwrite", "Yielded", "#Pop"], executable);
			
			if( parentFunction.returnType === baseReturnType )
				parentFunction.returnType = yieldType;
			else
				parentFunction.returnType = SWYM.TypeUnify(parentFunction.returnType, yieldType, node);
			parentFunction.bodyCScope["Yielded"] = parentFunction.returnType;
			
			return SWYM.VoidType;
		}},
		
	"return": {precedence:11, prefix:true, standalone:true,
		customCompile:function(node, cscope, executable)
		{
			var parentFunction = cscope["<withinFunction>"];
			if( !parentFunction )
			{
				SWYM.LogError(node, "Illegal return - cannot return when there's no enclosing function!");
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
				
				if( parentFunction.returnType !== undefined && parentFunction.returnType.type !== "incomplete" )
					parentFunction.returnType = SWYM.TypeUnify(parentFunction.returnType, returnType, node);
				else
					parentFunction.returnType = returnType;

				executable.push("#Return");
			}
			else
			{
				parentFunction.returnsNoValue = true;
				executable.push("#Return");
			}
			
			return SWYM.DontCareType;
		}},
	
	",":  {precedence:20, infix:true, postfix:true, noImplicitSemicolon:true,
		identity:function(){ return SWYM.jsArray([]); },
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
			var bakedArray = [];
			var tupleTypes = [];
			
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
							executables[Jdx].push("#SingletonArray");
						}
						
						if( resultType !== undefined )
						{
							resultType = SWYM.ToMultivalueType(resultType);
						}
					}
					
					if( bakedArray !== undefined )
					{
						if( typeN && typeN.baked !== undefined )
						{
							for( var bakedIdx = 0; bakedIdx < typeN.baked.length; ++bakedIdx )
							{
								bakedArray.push(typeN.baked.run(bakedIdx));
							}
						}
						else
						{
							bakedArray = undefined;
						}
					}
					
					tupleTypes = undefined; // TODO: support composing tuples out of tuple multivalues
				}
				else
				{
					if( bakedArray !== undefined )
					{
						if( typeN && typeN.baked !== undefined )
						{
							if( typeN.baked !== SWYM.value_novalues )
							{
								bakedArray.push(typeN.baked);
							}
						}
						else
						{
							bakedArray = undefined;
						}
					}
					
					if( tupleTypes !== undefined )
					{
						tupleTypes.push(typeN);
					}

					if ( isMulti )
					{
						executableN.push("#SingletonArray");
						typeN = SWYM.ToMultivalueType(typeN);
					}
				}

				if( resultType !== undefined )
				{
					resultType = SWYM.TypeUnify(resultType,typeN, node);
				}
				else
				{
					resultType = typeN;
				}
				
				executables.push(executableN);
			}
			
			if( tupleTypes !== undefined )
			{
				resultType = SWYM.ArrayToMultivalueType(SWYM.TupleTypeOf(tupleTypes, resultType));
			}
			else if( !isMulti )
			{
				resultType = SWYM.ToMultivalueType(resultType);
			}

			if( bakedArray !== undefined )
			{
				bakedArray = SWYM.jsArray(bakedArray);
				
				executable.push( "#Literal" );
				executable.push( bakedArray );

				resultType.baked = bakedArray;
			}
			else
			{
				for( var Idx = 0; Idx < executables.length; ++Idx )
				{
					SWYM.pushEach(executables[Idx], executable);
				}

				executable.push( isMulti ? "#ConcatArrays" : "#CreateArray" );
				executable.push(executables.length);
			}
			
			return resultType;
		}
	},

	":":  {precedence:25, infix:true,
		customCompile:function(node, cscope, executable)
		{
			SWYM.LogError(node, "':' can only be used within a table declaration.");
			return SWYM.VoidType;
		}
	},

	"returns": {precedence:30, infix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( lhs && (lhs.type === "decl" || (lhs.type === "fnnode" && lhs.isDecl)) )
			{
				var result = {type:"fnnode", pos:lhs.pos, body:rhs, isDecl:undefined, name:undefined, children:[], argNames:[]};
				return SWYM.CombineFnNodes(lhs, result);
			}
			else if ( lhs.type === "fnnode" )
			{
				SWYM.LogError(op.pos, "Invalid function declaration. (Did you forget to 'quote' the new function's name?)");
				return undefined;
			}
			else
			{
				SWYM.LogError(op.pos, "Invalid function declaration.");
				return undefined;
			}
		},
		customCompile:function(node, cscope, executable)
		{
			SWYM.LogError(node, "Fsckup: shoudn't be compiling the 'returns' operator directly!");
			return SWYM.VoidType;
		}
	},

	// TEMP - type cast operator
	"<<":  {precedence:32, infix:true,
		customCompile:function(node, cscope, executable)
		{
			var unusedExecutable = [];
			var typeType = SWYM.CompileNode(node.children[0], cscope, unusedExecutable);				
			var rhsType = SWYM.CompileNode(node.children[1], cscope, executable);
			
			// TODO: insert a run-time check.
			// SWYM.TypeCoerce(typeType.baked, rhsType, node);
			if( rhsType.baked !== undefined )
			{
				SWYM.TypeCoerce(typeType.baked, rhsType, node);
				return rhsType;
			}
			else
			{
				return typeType.baked;
			}
		}
	},

	"(decl)":  {precedence:35, postfix:true, standalone:true,
	    customParseTreeNode:function(lhs, op, rhs)
		{
			if( lhs !== undefined )
			{
				op.children = [lhs];
			}
			return op;
		},
		customCompile:function(node, cscope, executable)
		{
			SWYM.LogError(node, "Invalid declaration - did you forget to assign it a value?");
			return undefined;
		}
	},
	
	"=":  {precedence:40, infix:true, rightAssociative:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if ( lhs && lhs.type === "fnnode" && !lhs.isDecl )
			{
				// pass a __mutator={rhs} argument to this function
				var braceOp = SWYM.NewToken("op", op.pos, "{");
				var childNode = braceOp.behaviour.customParseTreeNode(undefined, braceOp, rhs);
				var result = {type:"fnnode", body:undefined, isDecl:undefined, name:undefined, children:[childNode], argNames:["__mutator"]};
				
				return SWYM.CombineFnNodes(lhs, result);
			}
			else
			{
				return SWYM.NonCustomParseTreeNode(lhs, op, rhs);
			}
		},
		customCompile:function(node, cscope, executable)
		{
			if ( !node.children[0] || !node.children[1] )
			{
				SWYM.LogError(node, "Fsckup: = operator missing children!?");
				return SWYM.AnyValue;
			}
			
			if( node.children[0].type === "decl" )
			{
				// declare a constant or variable
				var declNode = node.children[0];
				var valueType = SWYM.CompileNode(node.children[1], cscope, executable);
				
				if( declNode.children !== undefined && declNode.children[0] !== undefined )
				{
					// declaring a variable with an explicit type, e.g. "Int 'x' = 4"
					var unusedExecutable = [];
					var typeType = SWYM.CompileNode(declNode.children[0], cscope, unusedExecutable);
					
					var explicitType;
					
					if( !typeType || !typeType.baked || typeType.baked.type !== "type" )
					{
						SWYM.LogError(declNode.children[0], "Expected a type here");
						explicitType = valueType;
					}
					else
					{
						explicitType = typeType.baked;
						SWYM.TypeCoerce(explicitType, valueType, node);
					}
					
					SWYM.CreateLocal(declNode.value, explicitType, cscope, executable, node);
					cscope[declNode.value+"##mutable"] = true;
					return explicitType;
				}
				else
				{
					// declaring a constant, e.g. "'x' = 4"
					if( SWYM.TypeMatches(SWYM.VoidType, valueType) )
					{
						SWYM.LogError(node, "Invalid declaration - can't store a Void value.");
					}
					
					SWYM.CreateLocal( declNode.value, valueType, cscope, executable, node );
					return valueType;
				}
			}
			else if ( node.children[0].type === "name" )
			{
				// assign a local variable
				var varName = node.children[0].text;
				var varType = cscope[varName];
				if( !varType )
				{
					SWYM.LogError(node, "Variable "+node.children[0].text+" is not defined - did you forget to 'quote' it?");
				}
				else if( cscope[varName+"##mutable"] !== true )
				{
					SWYM.LogError(node, "Cannot assign - "+node.children[0].text+" is a constant.");
					return SWYM.VoidType;
				}

				var newValueType = SWYM.CompileNode(node.children[1], cscope, executable);
				if( newValueType && newValueType.multivalueOf !== undefined )
				{
					executable.push( "#ForceSingleValue" );
					newValueType = SWYM.ToSinglevalueType(newValueType);
				}
				
				SWYM.TypeCoerce(varType, newValueType, node);
				
				executable.push( "#Overwrite" );
				executable.push( node.children[0].text );
				
				return SWYM.VoidType;
			}
			else if( node.children[0].type === "name" && cscope[node.children[0].text] === undefined )
			{
				SWYM.LogError(node, "Invalid declaration. (Did you forget to 'quote' it?)");
			}
			else
			{
				var type0 = SWYM.CompileNode(node.children[0], cscope, executable);
				
				if( type0 !== undefined && SWYM.TypeMatches(SWYM.VariableType, type0) )
				{
					SWYM.LogError(node, "Invalid declaration. (Did you intend to call .set?)");
				}
				else
				{
					SWYM.LogError(node, "Invalid declaration.");
				}
			}
		}
	},
	"+=": {precedence:50, argTypes:[undefined, SWYM.NumberType], returnType:SWYM.VoidType, infix:true,
			customParseTreeNode:SWYM.BuildCompoundAssignmentNode("+"),
			customCompile:function(node, cscope, executable)
			{
				var varType = SWYM.CompileLValue(node.children[0], cscope, executable);
				executable.push("#Dup");
				executable.push("#VariableContents");
				var modType = SWYM.CompileNode(node.children[1], cscope, executable);
				executable.push("#Add");
				executable.push("#VariableAssign");
				SWYM.TypeCoerce(SWYM.VariableTypeContaining(SWYM.NumberType), varType, node);
				return varType;
			}
		},
	"-=": {precedence:50, argTypes:[SWYM.VarType, SWYM.NumberType], infix:true, returnType:SWYM.VoidType,
			customParseTreeNode:SWYM.BuildCompoundAssignmentNode("-"),
			customCompile:function(node, cscope, executable)
			{
				var varType = SWYM.CompileLValue(node.children[0], cscope, executable);
				executable.push("#Dup");
				executable.push("#VariableContents");
				var modType = SWYM.CompileNode(node.children[1], cscope, executable);
				executable.push("#Sub");
				executable.push("#VariableAssign");
				SWYM.TypeCoerce(SWYM.VariableTypeContaining(SWYM.NumberType), varType, node);
				return varType;
			}
		},
	"*=": {precedence:50, argTypes:[SWYM.VarType, SWYM.NumberType], infix:true, returnType:SWYM.VoidType,
			customParseTreeNode:SWYM.BuildCompoundAssignmentNode("*"),
			customCompile:function(node, cscope, executable)
			{
				var varType = SWYM.CompileLValue(node.children[0], cscope, executable);
				executable.push("#Dup");
				executable.push("#VariableContents");
				var modType = SWYM.CompileNode(node.children[1], cscope, executable);
				executable.push("#Mul");
				executable.push("#VariableAssign");
				SWYM.TypeCoerce(SWYM.VariableTypeContaining(SWYM.NumberType), varType, node);
				return varType;
			}
		},
	"/=": {precedence:50, argTypes:[SWYM.VarType, SWYM.NumberType], infix:true, returnType:SWYM.VoidType,
			customParseTreeNode:SWYM.BuildCompoundAssignmentNode("/"),
			customCompile:function(node, cscope, executable)
			{
				var varType = SWYM.CompileLValue(node.children[0], cscope, executable);
				executable.push("#Dup");
				executable.push("#VariableContents");
				var modType = SWYM.CompileNode(node.children[1], cscope, executable);
				executable.push("#Div");
				executable.push("#VariableAssign");
				SWYM.TypeCoerce(SWYM.VariableTypeContaining(SWYM.NumberType), varType, node);
				return varType;
			}
		},
	"%=": {precedence:50, argTypes:[SWYM.VarType, SWYM.NumberType], infix:true, returnType:SWYM.VoidType,
			customParseTreeNode:SWYM.BuildCompoundAssignmentNode("%"),
			customCompile:function(node, cscope, executable)
			{
				var varType = SWYM.CompileNode(node.children[0], cscope, executable);
				executable.push("#Dup");
				executable.push("#VariableContents");
				var modType = SWYM.CompileNode(node.children[1], cscope, executable);
				executable.push("#Mod");
				executable.push("#VariableAssign");
				SWYM.TypeCoerce(SWYM.VariableTypeContaining(SWYM.NumberType), varType, node);
				return varType;
			}
		},
		
	// the 'repeat' operator. 10**3 -> 10,10,10
	"**": {precedence:55, infix:true, argTypes:[SWYM.AnyType, SWYM.IntType],
		customCompile:function(node, cscope, executable)
		{
			var type0 = SWYM.CompileNode( node.children[0], cscope, executable );
			var type1 = SWYM.CompileNode( node.children[1], cscope, executable );
		
			if( type1 && type1.multivalueOf !== undefined )
				SWYM.LogError(node, "Error: Right-hand side of the ** operator cannot be a multi-value.");

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
			
			if( type0 && type0.multivalueOf === undefined )
				return SWYM.ToMultivalueType(type0);
			else
				return SWYM.ToMultivalueType(type0.multivalueOf);
		}
	},

	"&&": {precedence:60, infix:true, identity:function(v){ return true; },
		returnType:SWYM.BoolType,
		customCompile:function(node, cscope, executable)
		{
			var executable2 = [];
			var type1 = SWYM.CompileNode( node.children[1], cscope, executable2 );
			type1 = SWYM.TypeCoerce(SWYM.BoolType, type1, node.children[1]);

			var type0 = SWYM.CompileNode( node.children[0], cscope, executable );
			type0 = SWYM.TypeCoerce(SWYM.BoolType, type0, node.children[0]);

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
			type1 = SWYM.TypeCoerce(SWYM.BoolType, type1, node.children[1]);

			var type0 = SWYM.CompileNode( node.children[0], cscope, executable );
			type0 = SWYM.TypeCoerce(SWYM.BoolType, type0, node.children[0]);

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
				if( type1 && type1.multivalueOf !== undefined )
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
				SWYM.LogError(node, "Error - illegal argument to the Not operator.");
				return SWYM.DontCareType;
			}
		}},
	
	// range operators:
	// ascending or descending sequence that includes both endpoints.
	"..":  {precedence:75, infix:true, postfix:true, prefix:true, standalone:true,
		customCompile:function(node, cscope, executable)
		{
			var argExecutable = [];
			var startType;
			if( node.children[0] === undefined )
			{
				startType = SWYM.BakedValue(-Infinity);
				argExecutable.push("#Literal");
				argExecutable.push(startType.baked);
			}
			else
			{
				startType = SWYM.CompileNode( node.children[0], cscope, argExecutable );
			}

			var endType;
			if( node.children[1] === undefined )
			{
				endType = SWYM.BakedValue(Infinity);
				argExecutable.push("#Literal");
				argExecutable.push(endType.baked);
			}
			else
			{
				endType = SWYM.CompileNode( node.children[1], cscope, argExecutable );
			}

			if( node.children[0] === undefined ||
				node.children[1] === undefined ||
				SWYM.TypeMatches(SWYM.IntType, startType) )
			{
				if( node.children[0] !== undefined )
				{
					SWYM.TypeCoerce(SWYM.IntType, startType, node.children[0]);
				}
				if( node.children[1] !== undefined )
				{
					SWYM.TypeCoerce(SWYM.IntType, endType, node.children[1]);
				}
			
				if( startType.baked !== undefined && endType.baked !== undefined )
				{
					var literalValue = SWYM.RangeOp(startType.baked, endType.baked, true, true, undefined);
					executable.push("#Literal");
					executable.push( literalValue );

					var resultType = object(SWYM.RangeArrayType);
					resultType.baked = literalValue;
					resultType = SWYM.ArrayToMultivalueType( resultType );
					return resultType;
				}
				else
				{
					SWYM.pushEach(argExecutable, executable);
					executable.push("#Native");
					executable.push(2);
					executable.push( function(a, b){ return SWYM.RangeOp(a,b, true, true, undefined) });
					return SWYM.MultivalueRangeType;
				}
			}
			else if( SWYM.TypeMatches(SWYM.StringType, startType) && SWYM.TypeMatches(SWYM.StringType, endType) )
			{
				if( startType.baked !== undefined && endType.baked !== undefined )
				{
					var literalString = SWYM.CharRange(startType.baked,endType.baked);
					executable.push("#Literal");
					executable.push(literalString);
					return SWYM.ArrayToMultivalueType( SWYM.BakedValue(literalString) );
				}
				else
				{
					executable.push("#Native");
					executable.push(2);
					executable.push( function(a,b){ return SWYM.CharRange(a,b) });
					return SWYM.ToMultivalueType(SWYM.StringCharType);
				}
			}
			else
			{
				SWYM.LogError(node, "Invalid arguments to .. operator. (Expected Int..Int or String..String; got "+SWYM.TypeToString(startType)+".."+SWYM.TypeToString(endType)+")");
			}
		}},
	// ascending sequence that includes left, right, neither or both endpoints
	"..<": {precedence:75, argTypes:[SWYM.IntType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, false, 1); }, prefix:function(b){ return SWYM.rangeArray(-Infinity,b-1);} },
	"<..": {precedence:75, argTypes:[SWYM.NumberType,SWYM.IntType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, false, true, 1); }, postfix:function(a){ return SWYM.rangeArray(a+1,Infinity);} },
	"<..<":{precedence:75, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, false, false, 1); }},
	"<=..":{precedence:75, argTypes:[SWYM.NumberType,SWYM.IntType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, 1); }},
	"..<=":{precedence:75, argTypes:[SWYM.IntType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, 1); }},
	"<=..<=":{precedence:75, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, 1); }},
	// descending sequence that excludes left, right, neither or both endpoints
	"..>": {precedence:75, argTypes:[SWYM.IntType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, false, -1); }},
	">..": {precedence:75, argTypes:[SWYM.NumberType,SWYM.IntType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, false, true, -1); }},
	">..>":{precedence:75, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, false, false, -1); }},
	"..>=":{precedence:75, argTypes:[SWYM.IntType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, -1); }},
	">=..":{precedence:75, argTypes:[SWYM.NumberType,SWYM.IntType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, -1); }},
	">=..>=":{precedence:75, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, -1); }},
	
	"==": {precedence:80, returnType:SWYM.BoolType, infix:SWYM.IsEqual,
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},
	"!=": {precedence:80, returnType:SWYM.BoolType, infix:function(a,b){return !SWYM.IsEqual(a,b)},
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},

	// 'exactly equal' operators - useful?
	"===": {precedence:80, returnType:SWYM.BoolType, infix:function(a,b){ return SWYM.IsEqual(a,b,true) },
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},
	"!==": {precedence:80, returnType:SWYM.BoolType, infix:function(a,b){return !SWYM.IsEqual(a,b,true)},
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},

	// "v ==any P" and "v ==some P" are the same as "P.contains(v)".
	"==any": {precedence:80, argTypes:[SWYM.AnyType, SWYM.ArrayType], returnType:SWYM.BoolType,
		infix:function(a,b) { return SWYM.ArrayContains(b, a); },
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},

	"==some": {precedence:80, argTypes:[SWYM.AnyType, SWYM.ArrayType], returnType:SWYM.BoolType,
		infix:function(a,b) { return SWYM.ArrayContains(b, a); },
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},

	// "v !=any P" is the same as "P.!contains(v)"
	"!=any": {precedence:80, argTypes:[SWYM.AnyType, SWYM.ArrayType], returnType:SWYM.BoolType,
		infix:function(a,b){ return !SWYM.ArrayContains(b, a); },
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},

	// for completeness, although it's probably not useful, we should have "==every".

	">": {precedence:81, infix:true, customParseTreeNode:SWYM.AutoLhsOverloadableParseTreeNode(">"), prefix:true },
	">=": {precedence:81, infix:true, customParseTreeNode:SWYM.AutoLhsOverloadableParseTreeNode(">="), prefix:true },
	"<": {precedence:81, infix:true, customParseTreeNode:SWYM.AutoLhsOverloadableParseTreeNode("<"), prefix:true },
	"<=": {precedence:81, infix:true, customParseTreeNode:SWYM.AutoLhsOverloadableParseTreeNode("<="), prefix:true },
	
	">every":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a <= b.run(Idx) )
					return false;
			return true;
		},
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},
	">=every": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a < b.run(Idx) )
					return false;
			return true;
		},
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},
	"<every":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a >= b.run(Idx) )
					return false;
			return true;
		},
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},
	"<=every": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a > b.run(Idx) )
					return false;
			return true;
		},
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},
	">some":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a > b.run(Idx) )
					return true;
			return false;
		},
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},
	">=some": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a >= b.run(Idx) )
					return true;
			return false;
		},
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},
	"<some":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a < b.run(Idx) )
					return true;
			return false;
		},
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},
	"<=some": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberArrayType], returnType:SWYM.BoolType,
		infix:function(a,b)
		{
			for( var Idx = 0; Idx < b.length; Idx++ )
				if( a <= b.run(Idx) )
					return true;
			return false;
		},
		customParseTreeNode:SWYM.AutoLhsParseTreeNode, prefix:true
	},
	
	"--": {precedence:91,
			prefix:function(a,b,op){return SWYM.assignmentOp(b,{value:b.value-1},op);},
			postfix:function(a,b,op){ var temp = a.value; SWYM.assignmentOp(a,{value:a.value-1},op); return {value:temp}; }
		},
	
	"&bitwise": {precedence:96, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.NumberType, infix:function(a,b){return a&b}, identity:function(){return ~0;} },
	"|bitwise": {precedence:96, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.NumberType, infix:function(a,b){return a|b}, identity:function(){return 0;} },
	"^bitwise": {precedence:96, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.NumberType, infix:function(a,b){return a^b} },
	"~bitwise": {precedence:96, argTypes:[SWYM.NumberType], returnType:SWYM.NumberType, prefix:function(v){return ~v} },

	"+": {precedence:101, infix:true, customParseTreeNode:SWYM.OverloadableParseTreeNode("+") },
	"-": {precedence:102, prefixPrecedence:350, infix:true, prefix:true, customParseTreeNode:(function(baseCPTN)
		{
			return function(lhs, op, rhs)
			{
				// For the benefit of etc expressions, we turn expressions like -1 into simple negative number literals.
				if( lhs === undefined && rhs !== undefined && rhs.type === "literal" )
				{
					return SWYM.NewToken("literal", op.pos, "-"+rhs.text, -rhs.value);
				}
				else
				{
					return baseCPTN(lhs, op, rhs);
				}
			}
		}(SWYM.OverloadableParseTreeNode("-")))
	},
	"*": {precedence:103, infix:true, customParseTreeNode:SWYM.OverloadableParseTreeNode("*") },
	"/": {precedence:104, infix:true, customParseTreeNode:SWYM.OverloadableParseTreeNode("/") },
	"%": {precedence:105, infix:true, customParseTreeNode:SWYM.OverloadableParseTreeNode("%") },
	"^": {precedence:106, infix:true, customParseTreeNode:SWYM.OverloadableParseTreeNode("^") },

	".": { precedence:300, prefix:true, infix:true, noImplicitSemicolon:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			return SWYM.BuildDotNode(lhs, op, rhs);
		}
	},
	
	// logically negated function call, e.g. bob.!likes(jim)
	".!": { precedence:300, returnType:SWYM.BoolType, standalone:true, prefix:true, infix:true, postfix:true, noImplicitSemicolon:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			return SWYM.BuildDotNode(lhs, op, rhs, SWYM.operators["!"]);
		}
	},

	// toStringed function call, e.g. bob.$age
	".$": { precedence:300, returnType:SWYM.StringType, standalone:true, prefix:true, infix:true, postfix:true, noImplicitSemicolon:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			return SWYM.BuildDotNode(lhs, op, rhs, SWYM.operators["$"]);
		}
	},

	// toDebugStringed function call, e.g. bob.$$name
	".$$": { precedence:300, returnType:SWYM.StringType, standalone:true, prefix:true, infix:true, postfix:true, noImplicitSemicolon:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			return SWYM.BuildDotNode(lhs, op, rhs, SWYM.operators["$$"]);
		}
	},

	// Postfix version of the square bracket operator
	".[]": { precedence:300, returnType:SWYM.ArrayType, standalone:true, postfix:true, noImplicitSemicolon:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs )
				lhs = SWYM.NewToken("name", op.pos, "__default"); // ".[]" on its own means "__default.[]".

			op.behaviour = SWYM.operators["["];

			return SWYM.NonCustomParseTreeNode(undefined, op, lhs); //NB: lhs on the right
		}
	},

	// function-esque operators, e.g. length./2
	// not sure I like having these.
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

	"?": { precedence:300, infix:true, postfix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( rhs && rhs.type === "fnnode" && rhs.name === "else" )
			{
				//Ugh, this is so hacky. Need a proper grammar parser.
				rhs = {type:"fnnode", body:undefined, pos:rhs.pos, isDecl:false, name:undefined, children:[rhs.children[0]], argNames:["else"]};
			}
			
			var result = {type:"fnnode", body:undefined, pos:op.pos, isDecl:false, name:"?", children:[lhs], argNames:["this"]};
			
			return SWYM.CombineFnNodes(result, rhs);
		}
	},

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
				return {type:"fnnode", pos:lhs.pos, body:undefined, isDecl:false, name:lhs.text, children:[rhs], argNames:["__"]};
			}
			else
			{
				SWYM.LogError(0, "~ operator expects an identifier on the left hand side");
			}
		},
		customCompile:function(node, cscope, executable)
		{
			SWYM.LogError(node, "Fsckup - failed to use customParseTreeNode for the '~' operator.");
		}
	},

	"else": { precedence:330, infix:true, standalone:true, noImplicitSemicolon:true,
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

			if( lhs && lhs.type !== "fnnode" )
			{
				// if the left hand side hasn't been composed into a function call node yet, do it now
				// (necessary if you write x?{1}else{0}, because {1}else{0} has higher precedence.)
				lhs = {type:"fnnode", pos:lhs.pos, body:undefined, isDecl:undefined, name:undefined, children:[lhs], argNames:["__"]};
			}

			var result = {type:"fnnode", pos:op.pos, body:undefined, isDecl:undefined, name:undefined, children:[rhs], argNames:["else"]};
						
			return SWYM.CombineFnNodes(lhs, result);
		}
	},
	
	"(": { precedence:330, takeCloseBracket:")", prefix:true, infix:true, postfix:true, debugText:"parenth", noImplicitSemicolon:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs )
				return SWYM.NonCustomParseTreeNode(lhs, op, rhs);
				
			if (lhs.type === "fnnode" && lhs.pendingArgName !== undefined )
			{
				lhs.argNames.push(lhs.pendingArgName);
				lhs.children.push(rhs);
				lhs.pendingArgName = undefined;
				return lhs;
			}

			// function call
			var params = {type:"fnnode", etc:op.etc, pos:lhs.pos, body:undefined, isDecl:undefined, name:undefined, children:[], argNames:[]};
			
			if( op.etc !== undefined )
			{
				params.children.push(undefined);
				params.argNames.push("__");
			}
			
			SWYM.ReadParamBlock(rhs, params);
			return SWYM.CombineFnNodes(lhs, params);
		},
		customCompile:function(node, cscope, executable)
		{
			// only bracketed expressions (i.e. plain old BODMAS) get here
			return SWYM.CompileNode(node.children[1], cscope, executable);
		}
	},
	"[": { precedence:330, takeCloseBracket:"]", prefix:true, infix:true, standalone:true, postfix:true, debugText:"square",
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs )
				return SWYM.NonCustomParseTreeNode(lhs, op, rhs);

			if (lhs.type === "fnnode" && lhs.pendingArgName !== undefined )
			{
				lhs.argNames.push(lhs.pendingArgName);
				lhs.children.push(rhs);
				lhs.pendingArgName = undefined;
				return lhs;
			}

			// passing an array to a function call
			var arrayNode = SWYM.NonCustomParseTreeNode(undefined, op, rhs);
			var result = {type:"fnnode", pos:lhs.pos, body:undefined, isDecl:undefined, name:undefined, children:[arrayNode], argNames:["__"]};
			return SWYM.CombineFnNodes(lhs, result);
		},
		customCompile:function(node, cscope, executable)
		{
			SWYM.ConvertSeparatorsToCommas(node.children[1]);
			
			if( node.children[1] === undefined )
			{
				// empty array/table
				var emptyList = SWYM.jsArray([]);
				
				executable.push("#Literal");
				executable.push(emptyList);
				return SWYM.BakedValue(emptyList);
			}
			else
			{
				// list expression
				var type = SWYM.CompileNode(node.children[1], cscope, executable);

				if( !type || type.multivalueOf === undefined )
				{
					// wrap single values in a list
					executable.push( "#SingletonArray" );
					return SWYM.ArrayTypeContaining( type, false, true );
				}
				else if( type.quantifier !== undefined && type.quantifier[0] !== "EACH" )
				{
					SWYM.TypeCoerce(SWYM.BoolType, type.multivalueOf, node);
					// Insert the instruction(s) to resolve this quantifier into a single value

					var qexecutable = [];
					for( var Idx = type.quantifier.length-1; Idx >= 0; --Idx )
					{
						var q = type.quantifier[Idx];
						
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
					return SWYM.BoolType;
				}
				else if( type.isMutable )
				{
					// if the multivalue is a mutable array, make an immutable copy of it
					executable.push("#CopyArray");
					return SWYM.ArrayTypeContaining( type, false, false );
				}
				else
				{
					// otherwise, just reinterpret it back into an array (no-op)
					return SWYM.ArrayTypeContaining( type, false, true );
				}
			}
		}
	},
	"{": { precedence:330, takeCloseBracket:"}", prefix:true, infix:true, standalone:true, postfix:true, debugText:"curly", noImplicitSemicolon:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs )
				return SWYM.NonCustomParseTreeNode(lhs, op, rhs);

			if (lhs.type === "fnnode" && lhs.pendingArgName !== undefined )
			{
				lhs.argNames.push(lhs.pendingArgName);
				lhs.children.push(rhs);
				lhs.pendingArgName = undefined;
				return lhs;
			}

			// function call
			if( lhs && (lhs.type === "decl" || (lhs.type === "fnnode" && lhs.isDecl)) )
			{
				// something like  'fn'('x') {...}  or  String.'fn' {...}  - this is the body of the function.
				var result = {type:"fnnode", pos:lhs.pos, body:rhs, isDecl:undefined, name:undefined, children:[], argNames:[]};
			}
			else
			{
				// something like fn{...} - this is a block being passed as a function argument
				var lambdaNode = SWYM.NonCustomParseTreeNode(undefined, op, rhs);
				var result = {type:"fnnode", pos:lhs.pos, body:undefined, isDecl:undefined, name:undefined, children:[lambdaNode], argNames:["__"]};
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

	")": { isCloseBracket:true },
	"]": { isCloseBracket:true },
	"}": { isCloseBracket:true },
	
	// lambda argument name (partly built into the parser; this bit just handles
	// Int->String style function-type expressions)
	"->": { precedence:1000, infix:true,
		customCompile:function(node, cscope, executable)
		{
			var unusedExecutable = [];
			var argType = SWYM.CompileNode(node.children[0], cscope, unusedExecutable);
			var outType = SWYM.CompileNode(node.children[1], cscope, unusedExecutable);
			
			var resultType = SWYM.CallableTypeFromTo(argType.baked, outType.baked);
			executable.push("#Literal");
			executable.push(resultType);
			return SWYM.BakedValue(resultType);
		}
	},

	// this is the operator that string interpolations generate
	"(str++)": {precedence:1000, returnType:SWYM.StringType, infix:function(a,b){return SWYM.StringWrapper(a.data+b.data)} },

	// composes expressions like "& arg" into an argname token.
	// this is so messy. :-/
	"&": {precedence:2000, prefix:true, infix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( lhs !== undefined )
			{
				if( lhs.type === "name" && rhs.type === "name" )
				{
					// function call with a named argument - fn&name(foo)
					return {type:"fnnode", pos:lhs.pos, body:undefined, isDecl:undefined, name:lhs.text, children:[], argNames:[], pendingArgName:rhs.text};
				}
				else if( lhs.type === "fnnode" && rhs.type === "name" )
				{
					// function call with a named argument, and a previous argument - fn()&name(foo)
					lhs.pendingArgName = rhs.text;
					return lhs;
				}
				else if( rhs.type === "decl" )
				{
					// mandatory named argument with a type declaration - Anything &'foo'
					rhs.children = [lhs];
					rhs.explicitNameRequired = true;
					return rhs;
				}
				else
				{
					SWYM.LogError(op.pos, "Invalid use of the & operator");
					return lhs;
				}
			}
			
			if( rhs.type === "name" )
			{
				// an argument name
				// occurs either as fn &arg(x), or fn(&arg=x), or fn(&arg)
				return SWYM.NewToken("argname", op.pos, "&"+rhs.text, rhs.text);
			}
			else if( rhs.type === "decl" )
			{
				// declaration of a mandatory argument name
				rhs.explicitNameRequired = true;
				return rhs;
			}
			else
			{
				SWYM.LogError(op.pos, "Invalid use of the & operator");
				return rhs;
			}
		}
	}
};

//==================================================================================

SWYM.OneExpectedArg = { "this":{index:0} };
SWYM.TwoExpectedArgs = { "this":{index:0}, "that":{index:1} };

SWYM.DefaultGlobalCScope =
{
	"true": SWYM.BakedValue(true),
	"false": SWYM.BakedValue(false),
	"void": {type:"type", nativeType:"Void", debugName:"Void", baked:null},
	
	"Callable": SWYM.BakedValue(SWYM.CallableType),
	"Type": SWYM.BakedValue(SWYM.TypeType),
	"Container": SWYM.BakedValue(SWYM.ContainerType),
	"Table": SWYM.BakedValue(SWYM.TableType),
	"Array": SWYM.BakedValue(SWYM.ArrayType),
	"String": SWYM.BakedValue(SWYM.StringType),
	"Block": SWYM.BakedValue(SWYM.BlockType),
	"Bool": SWYM.BakedValue(SWYM.BoolType),
	"Number": SWYM.BakedValue(SWYM.NumberType),
	"Int": SWYM.BakedValue(SWYM.IntType),
	"Anything": SWYM.BakedValue(SWYM.AnyType),
	"DontCare": SWYM.BakedValue(SWYM.DontCareType),
	"Void": SWYM.BakedValue(SWYM.VoidType),
	"JSString": SWYM.BakedValue(SWYM.JSStringType),
	"MaybeFalse": SWYM.BakedValue(SWYM.MaybeFalseType),

	// these two are redundant, they should be indistinguishable from a user's perspective. The only reason they're both here is for testing purposes.
	"__novalues": {type:"type", debugName:"Literal(<no_values>)", multivalueOf:{type:"type", nativeType:"NoValues"}, baked:SWYM.jsArray([])},
	"value_novalues": SWYM.BakedValue(SWYM.value_novalues),
	
	"StringChar": SWYM.BakedValue(SWYM.StringCharType),
	
	"fn#Struct":
	[{
		expectedArgs:{ "body":{index:0, typeCheck:SWYM.BlockType} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
/*			if( !argTypes[0].baked && !argTypes[0].bodyNode )
			{
				SWYM.LogError(errorNode, "The body of the Struct function must be known at compile time!");
				return undefined;
			}*/
			
			var innerCScope = object(cscope);
			var unusedExecutable = [];
			var defaultNodes = {};
			
			var memberTypes = SWYM.CompileClassBody(argTypes[0].bodyNode, innerCScope, defaultNodes);			
			var newStruct = {type:"type", nativeType:"Struct", defaultNodes:defaultNodes, memberTypes:memberTypes};
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

	"fn#Mutable":
	[{
		expectedArgs:{ "this":{index:0, typeCheck:SWYM.TypeType} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			if( !argTypes[0].baked || argTypes[0].baked.nativeType !== "Struct")
			{
				SWYM.LogError(0, "The argument to the Mutable function must be a Struct type!");
				return undefined;
			}
			var baseStruct = argTypes[0].baked;
			
			if( baseStruct.isMutable )
			{
				// if this struct is itself mutable already
				executable.push("#Literal");
				executable.push(baseStruct);
				return SWYM.BakedValue(baseStruct);
			}
			else if( baseStruct.mutableType !== undefined )
			{
				// if this struct already had Mutable called on it
				executable.push("#Literal");
				executable.push(baseStruct.mutableType);
				return SWYM.BakedValue(baseStruct.mutableType);
			}
						
			var newStruct = {type:"type",
				nativeType:"Struct",
				isMutable:true,
				defaultNodes:baseStruct.defaultNodes,
				memberTypes:baseStruct.memberTypes
			};
			
			baseStruct.mutableType = newStruct;

			if( baseStruct.debugName !== undefined )
			{
				newStruct.debugName = "Mutable("+baseStruct.debugName+")";
			}
						
			var targetCScope = SWYM.MainCScope !== undefined? SWYM.MainCScope: SWYM.DefaultGlobalCScope;
			
			for( var memberName in newStruct.memberTypes )
			{
				if( newStruct.memberTypes.hasOwnProperty(memberName) )
				{
					SWYM.DeclareMutator(memberName, newStruct, newStruct.memberTypes[memberName], targetCScope);
				}
			}

			SWYM.DeclareNew(newStruct, newStruct.defaultNodes, targetCScope);
			
			executable.push("#Literal");
			executable.push(newStruct);
						
			return SWYM.BakedValue(newStruct);
		}
	}],
	
/*	"fn#AnyOf":
	[{
		expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable)
		{
			if( argTypes[0].baked === undefined )
			{
				SWYM.LogError(0, "The body of AnyOf must be known at compile time!");
				return undefined;
			}
			return SWYM.BakedValue(SWYM.GetOutType(argTypes[0]));
		}
	}],
*/
/*	"fn#enumAt":
	[{
		expectedArgs:{ "this":{index:0, typeCheck:{type:"swymObject"}}, "that":{index:1, typeCheck:SWYM.StringType} },
		returnType:{template:["@ArgTypeNamed",0,"@ArgTypeNamed",1,"@NamespaceMemberType"]},
		nativeCode:function(obj, name)
		{
			return obj.data[name];
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
	*/
	
	"fn#Literal":
	[{
		expectedArgs:{"this":{index:0, typeCheck:SWYM.AnyType}},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			if( !argTypes[0] || !argTypes[0].baked )
			{
				SWYM.LogError(0, "Calling Literal - value was not known at compile time!");
				return undefined;
			}
			var result = SWYM.BakedValue(argTypes[0].baked);
			executable.push("#Literal");
			executable.push(result);
			
			return SWYM.BakedValue(result);
		}
	}],
	
	"fn#Type":
	[{
		expectedArgs:{"this":{index:0}},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			var result = argTypes[0];
			if( !argTypes[0] )
			{
				SWYM.LogError(0, "Calling Type - type was not known at compile time!");
				return SWYM.DontCareType;
			}
			
			executable.push("#Literal");
			executable.push(result);
			
			return SWYM.BakedValue(result);
		},
		multiCustomCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			var result = argTypes[0];
			
			executable.push("#Literal");
			executable.push(result);
			
			return SWYM.BakedValue(result);
		}
	}],
	
	"fn#Subtype":
	[{
		expectedArgs:{
			"this":{index:0, typeCheck:SWYM.TypeType},
			"test":{index:1, typeCheck:SWYM.CallableType}
		},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			if( !argTypes[0] || !argTypes[0].baked || !argTypes[0].baked.describesType )
			{
				SWYM.LogError(0, "Calling Subtype: BaseType was not a compile-time type!");
				return undefined;
			}
			var baseTypeValue = argTypes[0].baked;
			var condType = SWYM.GetOutType(argTypes[1], baseTypeValue.describesType);
			SWYM.TypeCoerce(SWYM.BoolType, condType, errorNode);
			
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
			"this":{index:0, typeCheck:SWYM.DontCareType},
			"test":{index:1, typeCheck:SWYM.CallableType},
			"then":{index:2, typeCheck:SWYM.CallableType},
			"else":{index:3, typeCheck:SWYM.CallableType}
		},
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			var isMulti = (argTypes[0] && argTypes[0].multivalueOf !== undefined) ||
						(argTypes[1] && argTypes[1].multivalueOf !== undefined) || 
						(argTypes[2] && argTypes[2].multivalueOf !== undefined) ||
						(argTypes[3] && argTypes[3].multivalueOf !== undefined);
			
			var selfType = SWYM.ToSinglevalueType(argTypes[0]);
			var condExecutable = [];
			var condType = SWYM.CompileLambdaInternal(SWYM.ToSinglevalueType(argTypes[1]), selfType, condExecutable, errorNode);
			
			var bodyType = selfType;
			if( argTypes[1] && argTypes[1].baked && argTypes[1].baked.type === "type" )
			{
				bodyType = SWYM.TypeIntersect(selfType, argTypes[1].baked, errorNode);
			}
			var thenExecutable = [];
			var thenType = SWYM.CompileLambdaInternal(SWYM.ToSinglevalueType(argTypes[2]), bodyType, thenExecutable, errorNode);
			
			// TODO: do some kind of type-subtract so we can pass selfType minus bodyType in here.
			var elseExecutable = [];
			var elseType = SWYM.CompileLambdaInternal(SWYM.ToSinglevalueType(argTypes[3]), selfType, elseExecutable, errorNode);
			
			if( !SWYM.IsOfType(false, condType) && !SWYM.IsOfType(true, condType) )
			{
				SWYM.LogError(errorNode, "if: condition is of type "+SWYM.TypeToString(condType)+", which is never true or false.");
			}
			
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
				var cond = SWYM.ClosureExec(test, self, condExecutable);
				if( condToSingle )
				{
					cond = SWYM.ForceSingleValue(cond);
				}
				
				if( cond === false )
				{
					if( elseToMulti )
						return SWYM.jsArray([SWYM.ClosureExec(els, self, elseExecutable)]);
					else
						return SWYM.ClosureExec(els, self, elseExecutable);
				}
				else
				{
					if( thenToMulti )
						return SWYM.jsArray([SWYM.ClosureExec(then, self, thenExecutable)]);
					else
						return SWYM.ClosureExec(then, self, thenExecutable);
				}
			});

			return SWYM.TypeUnify(thenType, elseType, errorNode);
		}
	}],

	"fn#?":
	[{
		expectedArgs:{
			"this":{index:0, typeCheck:SWYM.AnythingType},
			"then":{index:1, typeCheck:SWYM.CallableType},
			"else":{index:2, typeCheck:SWYM.CallableType}
		},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			for( var Idx = 0; Idx < argExecutables.length; ++Idx)
			{
				SWYM.pushEach(argExecutables[Idx], executable);
			}
			executable.push("#RawNative");
			executable.push(function(stack)
			{
				var els = stack.pop();
				var then = stack.pop();
				var a = stack.pop();
				
				if( a !== SWYM.value_novalues )
				{
					var result = SWYM.ClosureCall(then, a);
				}
				else
				{
					var result = SWYM.ClosureCall(els, null);
				}
				
				stack.push(result);
			});
			
			var thenType = SWYM.GetOutType(argTypes[1], argTypes[0]);
			return SWYM.TypeUnify(thenType, SWYM.GetOutType(argTypes[2]), errorNode);
		},
		multiCustomCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			for( var Idx = 0; Idx < argExecutables.length; ++Idx)
			{
				SWYM.pushEach(argExecutables[Idx], executable);
			}
			executable.push("#Native");
			executable.push(3);
			executable.push(function(a, then, els)
			{
				if( a.length > 0 )
				{
					return SWYM.ForEachPairing([ a, SWYM.jsArray([then]) ], function(args)
					{
						return SWYM.ClosureCall(args[1], args[0]);
					});
				}
				else
				{
					return SWYM.jsArray([SWYM.ClosureCall(els, null)]);
				}
			});
			
			var thenType = SWYM.GetOutType(SWYM.ToSinglevalueType(argTypes[1]), SWYM.ToSinglevalueType(argTypes[0]));
			return SWYM.ToMultivalueType( SWYM.TypeUnify(thenType, SWYM.GetOutType(argTypes[2]), errorNode) );
		}
	},
	{
		expectedArgs:{
			"this":{index:0, typeCheck:SWYM.AnythingType},
			"else":{index:1, typeCheck:SWYM.CallableType}
		},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			for( var Idx = 0; Idx < argExecutables.length; ++Idx)
			{
				SWYM.pushEach(argExecutables[Idx], executable);
			}
			executable.push("#RawNative");
			executable.push(function(stack)
			{
				var els = stack.pop();
				var a = stack.pop();
				
				if( a !== SWYM.value_novalues )
				{
					stack.push(a);
				}
				else
				{
					stack.push(SWYM.ClosureCall(els, null));
				}
			});
			
			return SWYM.TypeUnify(argTypes[0], SWYM.GetOutType(argTypes[1]), errorNode);
		},
		multiCustomCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			for( var Idx = 0; Idx < argExecutables.length; ++Idx)
			{
				SWYM.pushEach(argExecutables[Idx], executable);
			}
			executable.push("#Native");
			executable.push(2);
			executable.push(function(a, els)
			{
				if( a.length > 0 )
				{
					return a;
				}
				else
				{
					return SWYM.jsArray([SWYM.ClosureCall(els, null)]);
				}
			});
			
			return SWYM.ToMultivalueType( SWYM.TypeUnify(SWYM.ToSinglevalueType(argTypes[0]), SWYM.GetOutType(argTypes[1]), errorNode) );
		}
	}],

	"fn#javascript":
	[{
		expectedArgs:{ "argList":{index:0, typeCheck:SWYM.BlockType}, "body":{index:1, typeCheck:SWYM.BlockType}, "pure":{index:2, typeCheck:SWYM.BoolType, defaultValueNode:SWYM.NewToken("literal", -1, "true", true)} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			if( !argTypes[0].baked && !argTypes[0].bodyNode )
			{
				SWYM.LogError(0, "The body of a javascript literal must be known at compile time!");
				return undefined;
			}
			
			var argsNode = argTypes[0].bodyNode;
			var nameNodes = [];
			var defaultValueNodes = [];
			SWYM.CollectClassMembers(argsNode, nameNodes, defaultValueNodes);
			
			var thisArgIdx = undefined;
			var argNameList = []
			var argNamesText = "";
			for( var Idx = 0; Idx < nameNodes.length; ++Idx )
			{
				var argName = nameNodes[Idx].value;
				argNameList.push( argName );
				if( argName === "this" )
				{
					thisArgIdx = Idx;
				}
				else
				{
					if( argNamesText !== "" )
					{
						argNamesText += ",";
					}
					argNamesText += argName;
				}
			}
			
			var bakedArgs;
			
			// if it's pure and we know all the args, consider precomputing it.
			// ...the world is not yet ready...
			/*if( argTypes[2] && argTypes[2].baked === true )
			{
				bakedArgs = [];
			}*/
			
			var argsExecutables = [];
			for( var Idx = 0; Idx < defaultValueNodes.length; ++Idx )
			{
				var argExecutable = [];
				argsExecutables[Idx] = argExecutable;
				
				var argType;
				if( defaultValueNodes[Idx] !== undefined )
				{
					argType = SWYM.CompileNode(defaultValueNodes[Idx], cscope, argExecutable);
				}
				else if( cscope[argNameList[Idx]] !== undefined )
				{
					argType = cscope[argNameList[Idx]];
					argExecutable.push("#Load");
					argExecutable.push(argNameList[Idx]);
				}
				else
				{
					SWYM.LogError(nameNodes[Idx], "Undefined argument '"+argNameList[Idx]+"'");
				}
				
				if( argType && argType.baked !== undefined && bakedArgs !== undefined )
				{
					if( Idx === thisArgIdx )
						bakedThisArg = argType.baked;
					else
						bakedArgs.push(argType.baked);
				}
				else
				{
					bakedArgs = undefined;
				}
				
				if( SWYM.TypeMatches(SWYM.StringType, argType) && argType !== SWYM.DontCareType )
				{
					// if it's definitely a string, convert to js string
					argExecutable.push("#Native")
					argExecutable.push(1)
					argExecutable.push(function(str){ return str.data; })
				}
				else
				{
					// if it might be a string, conditionally convert to js string
					argExecutable.push("#Native")
					argExecutable.push(1)
					argExecutable.push(function(str)
					{
						if(str !== undefined && str.type === "string")
						{
							return str.data;
						}
						else
						{
							return str;
						}
					})
				}
			}
			
			//FIXME: this is pretty half-assed. javascript's tokenizer uses quite different rules from swym's.
			// To do this right, we'll have to receive javascript code as a string.
			var functionText = "var jsFunction = function("+argNamesText+")"+argTypes[1].closureInfo.debugText;
			eval(functionText);
			
			if( bakedArgs !== undefined && ( thisArgIdx === undefined || bakedThisArg !== undefined ) )
			{
				var bakedResult = jsFunction.apply(bakedThisArg, bakedArgs);
				executable.push("#Literal");
				executable.push(bakedResult);
				return SWYM.BakedValue(bakedResult);
			}
			else
			{
				if( thisArgIdx !== undefined )
				{
					SWYM.pushEach(argsExecutables[thisArgIdx], executable);
				}
				
				for(var Idx = 0; Idx < argsExecutables.length; ++Idx )
				{
					if( Idx !== thisArgIdx )
					{
						SWYM.pushEach(argsExecutables[Idx], executable);
					}
				}

				if( thisArgIdx !== undefined )
				{
					executable.push( "#NativeThis" );
					executable.push(argsExecutables.length-1);
					executable.push(jsFunction);
				}
				else
				{
					executable.push( "#Native");
					executable.push(argsExecutables.length);
					executable.push(jsFunction);
				}
				return SWYM.DontCareType;
			}
		}
	}],

	"fn#jsstring":
	[{
		expectedArgs:{ "this":{index:0} },
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			executable.push("#Native");
			executable.push(1);
			executable.push(function(value){ return SWYM.ToTerseString(value) });
			return SWYM.JSStringType;
		}
	}],

	"fn#jscallback":
	[{
		expectedArgs:{ "body":{index:0} }, returnType:SWYM.JSFunctionType,
		customCompile:function(argTypes, cscope, executable)
		{
			var returnType = SWYM.GetOutType( argTypes[0], SWYM.AnyType ); // force compile
			executable.push("#Native");
			executable.push(1);
			executable.push(function(body)
			{
				return function(x)
				{
					result = SWYM.ClosureCall(body, x);
					return result;
				};
			});
		}
	}],
	
	"fn#output":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.StringType} },
			returnType:SWYM.VoidType,
			customCompile:function(argTypes, cscope, executable, errorNode)
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

	"fn#length":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
			returnType:SWYM.IntType,
			nativeCode:function(value){  return value.length;  } 
		}],
		
	"fn#toInt":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.NumberType} },
			returnType:SWYM.IntType,
			nativeCode:function(value){  return value|0;  } 
		}],
	
	"fn#Var":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.TypeType} },
			customCompileWithoutArgs:true,
			customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
			{
				if ( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
				{
					SWYM.LogError(0, "The argument to 'Var' must be a type.");
					return SWYM.VariableTypeContaining(SWYM.AnyType);
				}
				else
				{
					var varType = argTypes[0].baked;
					return SWYM.BakedValue(SWYM.VariableTypeContaining(varType));
				}
			}
		}],

	"fn#block":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.TypeType}, "body":{index:1, typeCheck:SWYM.BlockType} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			if ( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
			{
				SWYM.LogError(0, "The left argument to 'block' must be a type.");
				return SWYM.VariableTypeContaining(SWYM.AnyType);
			}
			
			var bodyExecutable = [];
			var argType = argTypes[0].baked;
			var outType = SWYM.CompileLambdaInternal(argTypes[1], argTypes[0].baked, bodyExecutable, errorNode);
			
			SWYM.pushEach(argExecutables[1], executable);

			var result = object(SWYM.CallableTypeFromTo(argType, outType));
			
			SWYM.pushEach([
				"#Native", 1,
				function(lookup)
				{
					return {
						type:"closure",
						debugName:lookup.debugName,
						run:function(key) { return SWYM.ClosureExec(lookup, key, bodyExecutable); }
					};
				}
			], executable);
			
			return result;
		}
	}],

	"fn#var":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.TypeType}, "value":{index:1} },
			customCompileWithoutArgs:true,
			customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
			{
				if ( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
				{
					SWYM.LogError(0, "The first argument to 'var' must be a type.");
					return SWYM.VariableTypeContaining(SWYM.AnyType);
				}
				else
				{
					var varType = argTypes[0].baked;
					SWYM.TypeCoerce(varType, argTypes[1], errorNode);
					
					SWYM.pushEach(argExecutables[1], executable);
					executable.push(argTypes[1] && argTypes[1].multivalueOf !== undefined? "#MultiNative": "#Native");
					executable.push(1);
					executable.push(function(v){return {type:"variable", value:v}});

					return SWYM.VariableTypeContaining(varType);
				}
			}
		}],
		
	"fn#at":[
		{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.MutableArrayType},
						"key":{index:1, typeCheck:SWYM.IntType},
						"__mutator":{index:2}, typeCheck:SWYM.CallableType },
			returnType:SWYM.VoidType,
			customCompile:function(argTypes, cscope, executable, errorNode)
			{
				var elementType = SWYM.GetOutType(argTypes[0], SWYM.IntType);
				
				var mutatorExecutable = [];
				var mutatorType = SWYM.CompileLambdaInternal(SWYM.ToSinglevalueType(argTypes[2]), elementType, mutatorExecutable, errorNode);
				
				if( !SWYM.TypeMatches(elementType, mutatorType) )
				{
					SWYM.LogError(errorNode, "Cannot store values of type "+SWYM.TypeToString(mutatorType)+" in an array of type "+SWYM.TypeToString(elementType));
				}
				
				executable.push("#Native");
				executable.push(3);
				executable.push
				(
					function(array, key, mutator)
					{
						array[key] = SWYM.ClosureExec( mutator, array[key], mutatorExecutable );
					}
				);
			}
		}],

	"fn#value":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.VariableType} },
			customCompile:function(argTypes, cscope, executable, errorNode)
			{
				executable.push("#VariableContents");
				return SWYM.GetVariableTypeContents(argTypes[0]);
			}
		},
		{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.VariableType}, "__mutator":{index:1} },
			returnType:SWYM.VoidType,
			customCompile:function(argTypes, cscope, executable, errorNode)
			{
				var mutatorExecutable = [];
				var mutatorType = SWYM.CompileLambdaInternal(SWYM.ToSinglevalueType(argTypes[1]), argTypes[0].contentType, mutatorExecutable, errorNode);

				SWYM.TypeCoerce(argTypes[0].contentType, mutatorType, errorNode);

				SWYM.pushEach([
					// initial stack: VAR, MUT
					"#Swap", "#Dup", // MUT, VAR, VAR
					"#VariableContents", // MUT, VAR, VALUE
					"#Swap", "#Swap3", // VAR, VALUE, MUT
					"#ClosureExec", mutatorExecutable, // VAR, MUTATED
					"#VariableAssign",
				], executable);
				
				return SWYM.VoidType;
			}
		}],

	"fn#mutableArray":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.TypeType}, "equals":{index:1, typeCheck:SWYM.ArrayType} },
			customCompileWithoutArgs:true,
			customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
			{
				if ( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
				{
					SWYM.LogError(0, "The first argument to 'mutableArray' must be a type.");
					return SWYM.ArrayTypeContaining(SWYM.AnyType, true, false);
				}
				else
				{
					var varType = argTypes[0].baked;
					SWYM.TypeCoerce(varType, argTypes[1].outType, errorNode);

					SWYM.pushEach(argExecutables[1], executable);
					executable.push("#CopyArray");

					return SWYM.ArrayTypeContaining(varType, true, false);
				}
			}
		}],
		
	"fn#random":[{  expectedArgs:{ "this":{index:0} },
		getReturnType:function(argTypes)
		{
			return SWYM.GetOutType(argTypes[0], SWYM.IntType);
		},
		nativeCode:function(array)
		{
			var randomIndex = Math.floor(Math.random() * array.length);
			return array.run(randomIndex);
		}
	}],

	"fn#do":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.DontCareType}, "fn":{index:1, typeCheck:SWYM.CallableType}},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			return SWYM.CompileClosureCall(argTypes[0], argExecutables[0], argTypes[1], argExecutables[1], cscope, executable, errorNode);
		},
		multiCustomCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			SWYM.pushEach(argExecutables[0], executable);
			if( argTypes[0].multivalueOf === undefined )
			{
				executable.push("#SingletonArray");
			}
			SWYM.pushEach(argExecutables[1], executable);
			if( argTypes[1].multivalueOf === undefined )
			{
				executable.push("#SingletonArray");
			}
			
			if( !argTypes[1].needsCompiling )
			{
				executable.push("#MultiClosureCall");
				
				return SWYM.ToMultivalueType( SWYM.GetOutType(argTypes[1], argTypes[0], errorNode) );
			}
			else
			{
				var closureType = argTypes[1];
				var bodyExecutable = [];
				var returnType = SWYM.CompileLambdaInternal(argTypes[1], SWYM.ToSinglevalueType(argTypes[0]), bodyExecutable);
				
				executable.push("#MultiClosureExec");
				executable.push(bodyExecutable);

				return SWYM.ToMultivalueType(returnType);
			}
			

/*		
			var isLazy = false;
			for( var Idx = 0; Idx < argExecutables.length; ++Idx )
			{
				SWYM.pushEach(argExecutables[Idx], executable);
				if( !argTypes[Idx] || argTypes[Idx].multivalueOf === undefined )
				{
					executable.push("#SingletonArray");
				}
				else if( argTypes[Idx] && argTypes[Idx].isLazy )
				{
					isLazy = true;
				}
			}
			executable.push(isLazy? "#LazyClosureCall": "#MultiClosureCall");
			SWYM.CompileClosureCall( SWYM.ToSinglevalueType(argTypes[1]), 
			var resultType = SWYM.GetOutType( SWYM.ToSinglevalueType(argTypes[1]), SWYM.ToSinglevalueType(argTypes[0]));
			
			// FIXME: subtle bug - if both arguments are quantifiers, and they were supplied in the opposite order
			// (thanks to the magic of named parameters), then we ought to be processing them in the opposite order.
			if( argTypes[0] && argTypes[0].multivalueOf )
			{
				resultType = SWYM.ToMultivalueType( resultType, argTypes[0].quantifier );
			}
			if( argTypes[1] && argTypes[1].multivalueOf )
			{
				resultType = SWYM.ToMultivalueType( resultType, argTypes[1].quantifier );
			}
			return resultType;*/
		}
	},
	{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.CallableType} },
		returnType:SWYM.VoidType,
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			var returnType = SWYM.GetOutType( argTypes[0], SWYM.VoidType );
			SWYM.CompileClosureCall(SWYM.VoidType, ["#Literal", undefined], argTypes[0], argExecutables[0], cscope, executable);
			return returnType;
		},
		multiCustomCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			executable.push("#Literal");
			var undefArray = [undefined];
			undefArray.type = "jsArray";
			undefArray.run = function(idx){ return this[idx]; };
			executable.push(undefArray);

			SWYM.pushEach(argExecutables[0], executable);

			executable.push("#MultiClosureCall");
			return SWYM.ToMultivalueType(SWYM.GetOutType( argTypes[0], SWYM.VoidType ));
		}
	}],

	"fn#each":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable, errorNode) { return SWYM.ArrayToMultivalueType(argTypes[0]); }, // each is basically a no-op!
	}],
	
	"fn#some":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable, errorNode) { return SWYM.ArrayToMultivalueType(argTypes[0], ["OR"]); }, // no-op!
	}],

	"fn#all":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable, errorNode) { return SWYM.ArrayToMultivalueType(argTypes[0], ["AND"]); }, // no-op!
	}],

	"fn#none":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable, errorNode) { return SWYM.ArrayToMultivalueType(argTypes[0], ["NOR"]); }, // no-op!
	}],

	"fn#lazy":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable, errorNode) { return SWYM.LazyArrayTypeContaining(SWYM.GetOutType(argTypes[0])); }, // no-op!
	}],

	"fn#eager":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable, errorNode) { return SWYM.ArrayTypeContaining(SWYM.GetOutType(argTypes[0])); }, // no-op!
	}],
	
	"fn#isLazy":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			var result = argTypes[0] && argTypes[0].isLazy == true;
			executable.push("#Literal");
			executable.push(result);
			
			return SWYM.BakedValue(result);
		}
	}],
	
	"fn#array":[{  expectedArgs:{
			"length":{index:0, typeCheck:SWYM.IntType},
			"at":{index:1, typeCheck:SWYM.CallableType},
			"isLazy":{index:2, typeCheck:SWYM.BoolType, defaultValueNode:SWYM.NewToken("literal", -1, "false", false)}
			//"__default":{index:0, typeCheck:{type:"union", subTypes:[{type:"jsArray"}, {type:"string"}, {type:"json"}]}}, "__rhs":{index:1, typeCheck:{type:"union", subTypes:[{type:"string"}, {type:"number"}]}}
		},
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			var elementExecutable = [];
			var elementType = SWYM.CompileLambdaInternal(argTypes[1], SWYM.IntType, elementExecutable, errorNode);

			executable.push("#Native");
			
			if( argTypes[2] === undefined )
				executable.push(2);
			else
				executable.push(3);

			if( elementType && elementType.multivalueOf !== undefined )
			{
				SWYM.LogError(errorNode, "Invalid array constructor - element type cannot be a multivalue");
			}
			else
			{
				executable.push(function(len, lookup, lazy)
				{
					return {
						type:"lazyArray",
						length:len,
						run:function(key) {return SWYM.ClosureExec(lookup,key,elementExecutable);}
					};
				});
			}
			
			if( argTypes[2] && argTypes[2].baked == true )
			{
				return SWYM.LazyArrayTypeContaining(elementType);				
			}
			else
			{
				return SWYM.ArrayTypeContaining(elementType);
			}
		}
	}],

	"fn#Array":[{  expectedArgs:{
			"this":{index:0, typeCheck:SWYM.TypeType},
		},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			if( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
			{
				SWYM.LogError(0, "Argument to the Array function is not a valid type expression!");
				return SWYM.DontCareType;
			}
			
			var arrayType = SWYM.ArrayTypeContaining(argTypes[0].baked);
			executable.push("#Literal");
			executable.push(arrayType);
			return SWYM.BakedValue(arrayType);
		}
	}],		

	"fn#String":[{  expectedArgs:{
			"this":{index:0, typeCheck:SWYM.IntType},
		},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			if( !argTypes[0] || !argTypes[0].baked )
			{
				SWYM.LogError(0, "Argument to the String function must be known at compile time!");
				return SWYM.DontCareType;
			}
			
			var resultType = SWYM.FixedLengthStringType(argTypes[0].baked);
			executable.push("#Literal");
			executable.push(resultType);
			return SWYM.BakedValue(resultType);
		}
	}],		

	"fn#ElementType":[{  expectedArgs:{
			"this":{index:0, typeCheck:SWYM.TypeType},
		},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode, argExecutables)
		{
			if( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
			{
				SWYM.LogError(0, "Argument to the ElementType function is not a valid type expression!");
				return SWYM.DontCareType;
			}
			
			var elementType = SWYM.GetOutType(argTypes[0].baked, SWYM.IntType);
			executable.push("#Literal");
			executable.push(elementType);
			return SWYM.BakedValue(elementType);
		}
	}],		
	
	"fn#distinct":[{
		expectedArgs:{"this":{index:0, typeCheck:SWYM.ArrayType} },
		nativeCode:SWYM.Distinct,
		getReturnType:function(argTypes, cscope) { return SWYM.ArrayTypeContaining(SWYM.GetOutType(argTypes[0])); }
	}],

	"fn#table":[{
		expectedArgs:{
			"keys":{index:0, typeCheck:SWYM.ArrayType},
			"body":{index:1, typeCheck:SWYM.CallableType}
			//"__default":{index:0, typeCheck:{type:"union", subTypes:[{type:"jsArray"}, {type:"string"}, {type:"json"}]}}, "__rhs":{index:1, typeCheck:{type:"union", subTypes:[{type:"string"}, {type:"number"}]}}
		},
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			var keyType = SWYM.GetOutType(argTypes[0], SWYM.IntType, errorNode);
			
			var valueExecutable = [];
			var valueType = SWYM.CompileLambdaInternal(argTypes[1], keyType, valueExecutable, errorNode);
		
			executable.push("#Native");
			executable.push(2);
			executable.push( function(keys, lookup)
			{
				return {type:"table", keys:SWYM.Distinct(keys), run:function(key){return SWYM.ClosureExec(lookup,key,valueExecutable)} }
			} );

			return SWYM.TableTypeFromTo(keyType, valueType);
		}
	}],
	
	"fn#keys":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ContainerType} },
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			executable.push("#Native");
			executable.push(1);
			executable.push(function(table)
			{
				if( table.keys )
				{
					return table.keys;
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
			else
			{
				SWYM.LogError(0, "Fsckup: no keys defined for ostensible Container type");
				return SWYM.ArrayType;
			}
		}
	}],

	"fn#values":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.EnumType} },
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			if( !argTypes[0] || !argTypes[0].baked || !argTypes[0].baked.enumValues )
			{
				SWYM.LogError(0, "Fsckup: Enum values must be known at compile time!?");
				return SWYM.DontCareType;
			}
			executable.push("#Literal");
			executable.push(argTypes[0].baked.enumValues);
			return SWYM.ArrayTypeContaining(argTypes[0].baked);
		}
	}],

	"fn#while":[{ expectedArgs:{ "test":{index:0, typeCheck:SWYM.CallableType}, "body":{index:1, typeCheck:SWYM.CallableType} },
		returnType:SWYM.VoidType,
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			var testExecutable = [];
			var testType = SWYM.CompileLambdaInternal(SWYM.ToSinglevalueType(argTypes[0]), SWYM.VoidType, testExecutable, errorNode);
			
			var bodyExecutable = [];
			var bodyType = SWYM.CompileLambdaInternal(SWYM.ToSinglevalueType(argTypes[1]), testType, bodyExecutable, errorNode);
			
			executable.push("#Native");
			executable.push(2);
			executable.push(function(test, body)
			{
				while(!SWYM.halt)
				{
					var condValue = SWYM.ClosureExec(test, undefined, testExecutable);
					if( condValue === false )
					{
						break;
					}
					else
					{
						SWYM.ClosureExec(body, condValue, bodyExecutable);
					}
				}
			});

			return SWYM.VoidType;
		}
	}],

	"fn#Element":
	[{
		expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			var argType = argTypes[0];
			if( argType === undefined )
			{
				SWYM.LogError(errorNode, "Array.Element requires an array argument.");
				return SWYM.DontCareType;
			}
			if( argType.baked === undefined || !SWYM.IsOfType(argType.baked, SWYM.ArrayType) )
			{
				SWYM.LogError(errorNode, "Array.Element requires an argument known at compile time.");
				return SWYM.DontCareType;
			}
			
			var newEnum = object(SWYM.GetOutType(argType, SWYM.IntType));
			newEnum.enumValues = argType.baked;
			newEnum.debugName = undefined;
			return SWYM.BakedValue(newEnum);
		}
	}],
	
	"fn#forEach":
	[{
		expectedArgs:{ "block":{index:0, typeCheck:SWYM.CallableType} },
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			var argType = SWYM.GetArgType(argTypes[0], errorNode);
			if( argType === undefined )
			{
				SWYM.LogError(errorNode, "forEach requires a block with an argument type.");
				return SWYM.DontCareType;
			}
			if( argType.baked !== undefined )
			{
				executable.push("#Literal");
				executable.push(argType.baked);
				executable.push("#Swap");			
				executable.push("#ClosureCall");
			}
			else if( argType.enumValues !== undefined )
			{
				executable.push("#SingletonArray");
				executable.push("#Literal");
				executable.push(argType.enumValues);
				executable.push("#Swap");			
				executable.push("#MultiClosureCall");
			}
			else if( argType.tupleTypes !== undefined )
			{
				executable.push("#SingletonArray");
				for( var Idx = 0; Idx < argType.tupleTypes.length; ++Idx )
				{
					var tupleElementType = argType.tupleTypes[Idx];
					if( tupleElementType.baked !== undefined )
					{
						executable.push("#Literal");
						executable.push(tupleElementType.baked);
						executable.push("#SingletonArray");
					}
					else if( tupleElementType.enumValues !== undefined )
					{
						executable.push("#Literal");
						executable.push(tupleElementType.enumValues);
					}
					else
					{
						SWYM.LogError(errorNode, "forEach - tuple element "+SWYM.TypeToString(tupleElementType)+" is not enumerable.");
					}
				}
				executable.push("#MultiNative");
				executable.push(argType.tupleTypes.length+1);
				executable.push(function()
				{
					var args = Array.prototype.slice.call(arguments);
					var closure = args.shift();
					return SWYM.ClosureCall(closure, SWYM.jsArray(args));
				});
			}
			else
			{
				SWYM.LogError(errorNode, "forEach(->) - block argument type is not enumerable.");
				return SWYM.DontCareType;
			}
				
			return SWYM.ArrayTypeContaining( SWYM.GetOutType( argTypes[0], argType) );
		}
	}],
	
	"fn#Tuple":
	[{
		expectedArgs:{ "pattern":{index:0, typeCheck:SWYM.ArrayTypeContaining(SWYM.TypeType)} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, errorNode)
		{
			if( !argTypes[0] || !argTypes[0].baked )
			{
				SWYM.LogError(0, "Argument to the Tuple function is not known at compile time!");
				return SWYM.DontCareType;
			}
			
			var result = SWYM.TupleTypeOf(argTypes[0].baked, undefined, errorNode);
			executable.push("#Literal");
			executable.push(result);
			return SWYM.BakedValue(result);
		}
	}],
}

//SWYM.stdlyb = "";
SWYM.stdlyb =
"\
//Swym loads this library by default, to implement various useful\n\
//Swym constants and functions.\n\
//NB: some built-in native functions (such as 'input', 'output',\n\
//'random', 'length', 'do', 'each', 'array', 'javascript', etc) plus a few special\n\
//constants that cannot be bootstrapped ('true', 'false' and 'novalues'),\n\
//are not defined here.\n\
\n\
\n\
//== Core language structures ==\n\
'pair'('a','b') returns [a,b]\n\
'tuple'('a') returns [a]\n\
'tuple'('a','b') returns [a,b]\n\
'tuple'('a','b','c') returns [a,b,c]\n\
'tuple'('a','b','c','d') returns [a,b,c,d]\n\
'tuple'('a','b','c','d','e') returns [a,b,c,d,e]\n\
'tuple'('a','b','c','d','e','f') returns [a,b,c,d,e,f]\n\
'tuple'('a','b','c','d','e','f','g') returns [a,b,c,d,e,f,g]\n\
\n\
Anything.'javascript'(&'pure'=false, 'body') returns javascript(&pure=pure){'this'}(body)\n\
\n\
'forEach'(Array 'arr')(Callable 'fn') returns arr.map(fn)\n\
\n\
'forEach_lazy'(Array 'arr')(Callable 'fn') returns\n\
	array(&length=arr.length) 'idx'->{ arr.at(idx).(fn) }\n\
\n\
'case'('key')(Callable 'body') returns key.(body)\n\
Anything.'case'(Callable 'body') returns this.(body)\n\
\n\
Anything.'of' returns this\n\
Anything.'is'(Callable 'fn') returns .(fn)\n\
Anything.'box' returns [this]\n\
\n\
Anything.'print' { output($this) }\n\
Anything.'println' { output(\"$this\\n\") }\n\
Anything.'trace' { output(\"$$this\\n\") }\n\
\n\
'if'(MaybeFalse 'cond', Callable 'then', Callable 'else') returns\n\
	void.if{ cond }(then) else (else)\n\
\n\
'if'(MaybeFalse 'cond', Callable 'then') returns\n\
	void.if{ cond }(then) else { __novalues }\n\
\n\
Anything.'if'(Callable 'test', Callable 'then') returns\n\
	.if(test)(then) else { void }\n\
\n\
Anything.'if'(MaybeFalse 'cond') returns\n\
	.if{cond}{it} else {__novalues}\n\
\n\
Anything.'if'(Callable 'test') returns\n\
	.if(test){it} else {__novalues}\n\
\n\
Anything.'if'(MaybeFalse 'cond', Callable 'else') returns\n\
	.if{cond}{it} else (else)\n\
\n\
Anything.'if'(Callable 'test', Callable 'else') returns\n\
	.if(test){it} else (else)\n\
\n\
Anything.'if'(MaybeFalse 'cond', Callable 'then', Callable 'else') returns\n\
	.if{cond}(then) else (else)\n\
\n\
Anything.'or_if'(Callable 'test')(Callable 'body') returns\n\
	.if(test)(body) else {it}\n\
\n\
Anything.'or_if'(MaybeFalse 'cond')(Callable 'body') returns\n\
	.if{cond}(body) else {it}\n\
\n\
'unchanged' = 'original'->{original}\n\
'{+}' = ['a','b']->{a+b}\n\
'{-}' = ['a','b']->{a-b}\n\
'{*}' = ['a','b']->{a*b}\n\
'{/}' = ['a','b']->{a/b}\n\
'{%}' = ['a','b']->{a%b}\n\
'{^}' = ['a','b']->{a^b}\n\
'{&&}' = ['a','b']->{a&&b}\n\
'{||}' = ['a','b']->{a||b}\n\
'{==}' = ['a','b']->{a==b}\n\
'{!=}' = ['a','b']->{a!=b}\n\
'{>}' = ['a','b']->{a>b}\n\
'{<}' = ['a','b']->{a<b}\n\
'{>=}' = ['a','b']->{a>=b}\n\
'{<=}' = ['a','b']->{a<=b}\n\
\n\
\n\
//== Default operator overloads ==\n\
'-'(Int 'rhs') returns\n\
	Int<< javascript(&pure){'rhs'}{ return -rhs }\n\
\n\
Int.'-'(Int 'rhs') returns\n\
	Int<< javascript(&pure){'this', 'rhs'}{ return this-rhs }\n\
\n\
Int.'+'(Int 'rhs', '__identity'=0) returns\n\
	Int<< javascript(&pure){'this', 'rhs'}{ return this+rhs }\n\
\n\
Int.'*'(Int 'rhs', '__identity'=1) returns\n\
	Int<< javascript(&pure){'this', 'rhs'}{ return this*rhs }\n\
\n\
Int.'%'(Int 'rhs') returns\n\
	Int<< javascript(&pure){'this', 'rhs'}{ return this%rhs }\n\
\n\
Int.'^'(Int 'rhs') returns\n\
	Int<< javascript(&pure){'this', 'rhs'}{ return Math.pow(this,rhs) }\n\
\n\
'-'(Number 'rhs') returns\n\
	Number<< javascript(&pure){'rhs'}{ return -rhs }\n\
\n\
Number.'-'(Number 'rhs') returns\n\
	Number<< javascript(&pure){'this', 'rhs'}{ return this-rhs }\n\
\n\
Number.'+'(Number 'rhs', '__identity'=0) returns\n\
	Number<< javascript(&pure){'this', 'rhs'}{ return this+rhs }\n\
\n\
Number.'*'(Number 'rhs', '__identity'=1) returns\n\
	Number<< javascript(&pure){'this', 'rhs'}{ return this*rhs }\n\
\n\
Number.'/'(Number 'rhs') returns\n\
	Number<< javascript(&pure){'this', 'rhs'}{ return this/rhs }\n\
\n\
Number.'%'(Number 'rhs') returns\n\
	Number<< javascript(&pure){'this', 'rhs'}{ return this%rhs }\n\
\n\
Number.'^'(Number 'rhs') returns\n\
	Number<< javascript(&pure){'this', 'rhs'}{ return Math.pow(this,rhs) }\n\
\n\
Array.'+'(Array 'arr', '__identity'=[]) returns\n\
	[.each, arr.each]\n\
\n\
Array.'*'(Int 'times') returns\n\
	array(&length=.length*times)(.cyclic)\n\
\n\
String.'+'(String 'str', '__identity'=\"\") returns\n\
	[.each, str.each]\n\
\n\
Number.'<'(Number 'rhs') returns\n\
	Bool<< javascript(&pure){'this', 'rhs'}{ return this<rhs }\n\
\n\
String.'<'(String 'rhs') returns\n\
	Bool<< javascript(&pure){'this', 'rhs'}{ return this<rhs }\n\
\n\
String(1).'-'(String(1) 'rhs') returns .unicodeValue - rhs.unicodeValue\n\
\n\
String(1).'+'(Int 'rhs') returns String(1) << (.unicodeValue + rhs).unicodeToString\n\
\n\
StringChar.'+'(Int 'rhs') returns StringChar << (.unicodeValue + rhs).unicodeToString\n\
\n\
//== Numbers ==\n\
'Empty' = {.length == 0}\n\
'PI' = 3.1415926535897926\n\
Number.'neg' returns -this\n\
Number.'degToRad' returns this*PI/180\n\
Number.'radToDeg' returns this*180/PI\n\
Number.'abs' returns if(this>=0){ this } else { -this }\n\
Number.'mod'(Number 'other') returns ((this%other)+other)%other\n\
Number.'differenceFrom'(Number 'n') returns abs(this-n)\n\
Number.'divisibleBy'(Number 'n') returns this%n == 0\n\
Number.'clamp'(Number &'min') returns if(this < min){ min } else { this }\n\
Number.'clamp'(Number &'max') returns if(this > max){ max } else { this }\n\
Number.'clamp'(Number &'min', Number &'max') returns .clamp(&min=min).clamp(&max=max)\n\
Int.'factorial' returns product[1<=..this]\n\
\n\
Int.'choose'(Int 'n') // (Pascal's triangle)\n\
{\n\
  if(n>this) { 0 }\n\
  else { floor( product[(this-n)<..this] / n.factorial ) }\n\
}\n\
\n\
Int.Array.'lcm' returns .reduce{ floor(.product/.gcd) }\n\
\n\
Int.Array.'gcd' returns .reduce\n\
{\n\
  Int 'a' = .max\n\
  Int 'b' = .min\n\
  Int 'r' = 0\n\
  while{b != 0} {\n\
    r = a % b\n\
    a = b\n\
    b = r\n\
  }\n\
  a\n\
}\n\
\n\
\n\
//== Callables ==\n\
Callable.'map'(Callable 'body') returns 'key'->{ key.(this).(body) }\n\
Callable.'at'(Anything 'key') returns key.(this)\n\
Callable.'atEach'(Int.Array 'keys') returns keys.map(this)\n\
Callable.'slice'['a'..<'b'] returns [a..<b].map(this)\n\
Callable.'slice'(Int &'start') returns .slice[start ..< .length]\n\
Callable.'slice'(Int &'length') returns .slice[0..<length]\n\
Callable.'slice'(Int &'end') returns .slice[0..<end]\n\
Callable.'slice'(Int &'last') returns .slice[0..last]\n\
Callable.'slice'(Int &'trimEnd') returns .slice[0 ..< .length-trimEnd]\n\
Callable.'slice'(Int &'start',Int &'end') returns .slice[start..<end]\n\
Callable.'slice'(Int &'start',Int &'last') returns .slice[start..last]\n\
Callable.'slice'(Int &'start',Int &'length') returns .slice[start..<start+length]\n\
Callable.'slice'(Int &'length',Int &'end') returns .slice[end-length..<end]\n\
Callable.'slice'(Int &'length',Int &'last') returns .slice[last-length-1..last]\n\
Callable.'non' returns {!.(this)}\n\
\n\
Container.'else'('els') returns 'key'->\n\
{\n\
  this.at(key) else (els)\n\
}\n\
\n\
Array.'cyclic' returns (Int 'idx')->{ idx.mod(this.length).(this) }\n\
Container.'partial' returns .else(unchanged)\n\
\n\
//== Tables ==\n\
Table.'map'(Callable 'body') returns .cells.tabulateBy{.key}{.value.(body)}\n\
\n\
Container.'at'('key','then'=unchanged,'else')\n\
{\n\
  if( key.in(.keys) )\n\
  {\n\
    key.assert(this.KeyType).(this).(then)\n\
  }\n\
  else\n\
  {\n\
    key.(else)\n\
  }\n\
}\n\
\n\
Table.'frequenciesToArray' returns\n\
	.keys.map 'key'->{ key**this.at(key) }\n\
\n\
'table'(Array &'keys', Array &'values') returns\n\
	{ keys.1st:values.1st, keys.2nd:values.2nd, etc }\n\
\n\
'table'(Array &'keys', Array &'values', Callable &'default')\n\
{\n\
  'indexer' = table(&keys=keys, &values=keys.keys)\n\
  \n\
  table(keys) 'key'->\n\
  {\n\
    indexer.at(key){.(values)} else {key.(default)}\n\
  }\n\
}\n\
\n\
Table.'values' returns [.at(.keys.each)]\n\
\n\
// Used to replace a chain of if-else-ifs with a table\n\
'select'(Table 'table') returns table.at(true)\n\
\n\
'selectWhere'(Callable 'test', Table 'table', Callable 'else') returns\n\
    table.keys.firstWhere(test)(table) else (else)\n\
\n\
Array.'inverse' returns table(&keys=this, &values=.keys)\n\
\n\
Table.'inverse' returns table(&keys=.values, &values=.keys)\n\
\n\
\n\
// == Strings ==\n\
String.'lines' returns .splitOn(\"\\n\")\n\
String.'words' returns .splitOnAny(\" \\t\\n\")\n\
\n\
Number.'s_plural' returns if(this==1) {\"\"} else {\"s\"}\n\
\n\
String.'lowercase' returns\n\
	String<< .javascript{ return SWYM.StringWrapper(this.toLowerCase()) }\n\
\n\
StringChar.'lowercase' returns\n\
	StringChar<< .javascript{ return SWYM.StringWrapper(this.toLowerCase()) }\n\
\n\
String.'uppercase' returns\n\
	String<< .javascript{ return SWYM.StringWrapper(this.toUpperCase()) }\n\
\n\
StringChar.'uppercase' returns\n\
	StringChar<< .javascript{ return SWYM.StringWrapper(this.toUpperCase()) }\n\
\n\
// == Encoding & Decoding ==\n\
\n\
String.'unicode' returns\n\
	[.each.{ Int<< .javascript{ return this.charCodeAt(0) } }]\n\
\n\
String(1).'unicodeValue' returns .unicode.1st\n\
\n\
Int.Array.'unicodeToString' returns $[.each.unicodeToString]\n\
Int.'unicodeToString' returns StringChar<<.javascript{ return SWYM.StringWrapper(String.fromCharCode(this)); }\n\
\n\
String.'caesarEncode'(Int 'offset')\n\
{\n\
  'alphabet' = $[\"Aa\"..\"Zz\"]\n\
  this.map( table(&keys=alphabet, &values=alphabet.arrayRotate(offset*2), &default=unchanged) )\n\
}\n\
\n\
String.'caesarDecode'(Int 'offset') returns .caesarEncode(-offset)\n\
\n\
String.'rot13' returns .caesarEncode(13)\n\
\n\
Int.'baseEncode'(Array 'encoding')\n\
{\n\
	'base' = [encoding.at(this%encoding.length)]\n\
\n\
	base.or_if( this >= encoding.length )\n\
	{\n\
		(this/encoding.length).floor.baseEncode(encoding) + base\n\
	}\n\
}\n\
\n\
String.'baseDecode'(Array 'encoding')\n\
{\n\
	'digits' = .map 'c'->{ encoding.firstKeyWhere{==c} else {return 0} }\n\
	'factor' = encoding.length\n\
\n\
	return digits.1stLast*factor^0 + digits.2ndLast*factor^1 + etc\n\
}\n\
\n\
Int.'binaryEncode' returns .baseEncode(\"01\")\n\
String.'binaryDecode' returns .baseDecode(\"01\")\n\
\n\
Int.'octalEncode' returns .baseEncode[\"0\"..\"7\"]\n\
String.'octalDecode' returns .baseDecode[\"0\"..\"7\"]\n\
\n\
Int.'decimalEncode' returns .baseEncode[\"0\"..\"9\"]\n\
String.'decimalDecode' returns .baseDecode[\"0\"..\"9\"]\n\
String.'toInt' returns .baseDecode[\"0\"..\"9\"]\n\
\n\
'hexEncoding' = $[\"0\"..\"9\", \"a\"..\"f\"]\n\
\n\
Int.'hexEncode' returns .baseEncode(hexEncoding)\n\
String.'hexDecode' returns .lowercase.baseDecode(hexEncoding)\n\
\n\
'base64DigitEncoding' = $[\"A\"..\"z\", \"0\"..\"9\", \"+\", \"/\"]\n\
\n\
String.'base64Encode'\n\
{\n\
    'binaryString' = .unicode.map{.binaryEncode.prepad(&with=\"0\", &length=8)}.flatten\n\
	'blocks' = binaryString.splitAt[6, 12, etc..<binaryString.length]\n\
	'code' = blocks.map{.pad(&with=\"0\", &length=6).binaryDecode.(base64DigitEncoding)}\n\
\n\
	code.pad(&with=\"=\", &length=4*ceil(code.length/4))\n\
}\n\
\n\
String.'base64Decode'\n\
{\n\
	'decodedDigits' = .where{!=\"=\"}.map(base64DigitEncoding.inverse)\n\
	'binaryString' = decodedDigits.map{.binaryEncode.prepad(&with=\"0\", &length=6)}.flatten\n\
	'bytes' = [[binaryString.at(0..<8)], [binaryString.at(8..<16)], etc]\n\
\n\
	bytes.map{.binaryDecode}.unicodeToString\n\
}\n\
\n\
//== Arrays ==\n\
Array.'atEnd'('idx') returns this.at(this.length-1-idx)\n\
Array.'map'(Callable 'body') returns [.each.(body)]\n\
Array.'atEach'(Int.Array 'keys') returns [ this.at(keys.where{ .in(this.keys) }.each) ]\n\
Array.'keys' returns [0..<.length]\n\
Array.'#st' returns this.at(#-1)\n\
Array.'#nd' returns this.at(#-1)\n\
Array.'#rd' returns this.at(#-1)\n\
Array.'#th' returns this.at(#-1)\n\
Array.'#st'('else') returns .at(#-1) else(else)\n\
Array.'#nd'('else') returns .at(#-1) else(else)\n\
Array.'#rd'('else') returns .at(#-1) else(else)\n\
Array.'#th'('else') returns .at(#-1) else(else)\n\
Array.'#stLast' returns .atEnd(#-1)\n\
Array.'#ndLast' returns .atEnd(#-1)\n\
Array.'#rdLast' returns .atEnd(#-1)\n\
Array.'#thLast' returns .atEnd(#-1)\n\
Array.'last' returns .atEnd(0)\n\
['lhs','rhs'].'lhs' returns lhs\n\
['lhs','rhs'].'rhs' returns rhs\n\
\n\
Array.'flatten' returns [ .each.each ]\n\
\n\
Array.Array.'flatten'(Array &'separator') returns\n\
    .1st + .tail.map{separator+it}.flatten\n\
\n\
Array.Array.'flatten'(Array &'separator', Array &'final')\n\
{\n\
	if( this.length <= 1 )\n\
	{\n\
		this.flatten\n\
	}\n\
	else\n\
	{\n\
		this.1st + this.middle.map{separator+it}.flatten + final + this.last\n\
	}\n\
}\n\
\n\
// Broadside: compose two arrays together by pairing their corresponding\n\
// elements. If one is longer than the other, its extra elements are ignored.\n\
// (Mnemonic: one ship shooting cannonballs at another. Each cannonball hits\n\
// the corresponding position in the other ship. AKA zip, but that metaphor sucks.)\n\
Array.'broadside'(Array 'rhs')(Callable 'body') returns\n\
    [[this.1st, rhs.1st].(body), [this.2nd, rhs.2nd].(body), etc]\n\
\n\
Array.'broadside'(Callable 'body')(Array 'rhs') returns .broadside(rhs)(body)\n\
\n\
Anything.'accumulate'(Array 'terms', Callable 'body') returns\n\
  this.{ [it, terms.1st].(body) }.{ [it, terms.2nd].(body) }.etc\n\
\n\
Array.'reduce'('body') returns\n\
  .1st.{ [it, this.2nd].(body) }.{ [it, this.3rd].(body) }.etc\n\
\n\
Array.'tabulateBy'(Callable 'key', Callable 'value'={it})\n\
{\n\
  table(&keys=.map(key), &values=.map(value))\n\
}\n\
Array.'tabulate'(Callable 'value')\n\
{\n\
  table(&keys=this, &values=this.map(value))\n\
}\n\
Array.'each'('fn') returns [.each.(fn)]\n\
Array.'no' { yield .none }\n\
Array.'oneOrMore' { yield .some }\n\
Array.'all'('body') returns [.all.(body)]\n\
Array.'some'('body') returns [.some.(body)]\n\
Array.'none'('body') returns [.none.(body)]\n\
Array.'no'('body') returns [.no.(body)]\n\
\n\
Array.'contains'(Block 'test') returns .1st.(test) || .2nd.(test) || etc;\n\
Array.'containsValue'('target') returns (.1st == target) || (.2nd == target) || etc;\n\
\n\
Array.'where'('test') returns .map{ .if(test) }\n\
\n\
Array.'where'('test')('body') returns\n\
	forEach(this){ .if(test)(body) else {__novalues}  }\n\
\n\
Array.'where'('test', 'body', 'else') returns\n\
	forEach(this){ .if(test)(body) else (else) }\n\
\n\
Array.'whereKey'('test') returns\n\
	forEach(.keys){ .if(test)(this) else {__novalues} }\n\
\n\
Array.'whereKey'('test', 'body') returns\n\
	forEach(.keys){ .if(test){.(this).(body)} else {__novalues} }\n\
\n\
Array.'whereKey'('test', 'body', 'else') returns\n\
	forEach(.keys){ .if(test){.(this).(body)} else {.(this).(else)} }\n\
\n\
Array.'slice'(Int &'start',Int &'trimEnd') returns\n\
	.slice[start ..< .length-trimEnd]\n\
\n\
Array.'slice'(Int &'length',Int &'trimEnd') returns\n\
	.slice[.length-length-fromEnd ..< .length-trimEnd]\n\
\n\
Array.'slice'['a'..<'b'] returns\n\
	[ .at(a.clamp(&min=0)..<b.clamp(&max=.length)) ]\n\
\n\
Array.'slices'(Int &'length') returns array(.length+1-length) 'start'->\n\
{\n\
  this.slice(&start=start, &end=start+length)\n\
}\n\
\n\
Array.'slices' returns [ .slices(&length=1 .. .length).each ]\n\
Array.'trimStart'(Int 'n') returns .atEach[n ..< .length]\n\
Array.'trimEnd'(Int 'n') returns .atEach[0 ..< .length-n]\n\
\n\
Array.'startsWith'(Array 'list') returns\n\
	.length >= list.length && .stem(list.length) == list\n\
\n\
Array.'endsWith'(Array 'list') returns\n\
	.length >= list.length && .tail(list.length) == list\n\
\n\
Array.'splitAt'(Int 'key') returns\n\
	[ .slice[..<key], .slice[key..] ]\n\
\n\
Array.'splitAtEnd'(Int 'n') returns\n\
	[ .slice(&trimEnd=n), .tail(n) ]\n\
\n\
Array.'splitAt'(Int.Array 'keys') returns if(keys == []){ [this] } else\n\
{[\n\
  this.slice[..<keys.1st];\n\
  this.slice[keys.1st..<keys.2nd], this.slice[keys.2nd..<keys.3rd], etc;\n\
  this.slice[keys.last..];\n\
]}\n\
\n\
Array.'splitWhere'(Callable 'test') returns .splitAt(.keysWhere(test))\n\
Array.'splitOut'(Int.Array 'keys') returns\n\
	[-1, keys.each, .length].{\n\
		[\n\
			this.slice(&start=.1st+1, &end=.2nd),\n\
			this.slice(&start=.2nd+1, &end=.3rd),\n\
			etc\n\
		]\n\
	}\n\
Array.'splitOutWhere'(Callable 'test') returns .cells.where{.value.(test)}.splitOut\n\
Array.'splitOn'('value') returns .splitOutWhere{==value}\n\
Array.'splitOnAny'(Array 'values') returns .splitOutWhere{==any values}\n\
\n\
Array.'tail' returns .atEach[1 ..< .length]\n\
Array.'tail'(Int 'length') returns .slice( &start=(.length-length).clamp(&min=0) )\n\
Array.'tailWhere'('test') returns .slice( &start=1+.lastKeyWhere{.!(test)})\n\
\n\
Array.'stem' returns .atEach[0 ..< .length-1]\n\
Array.'stem'(Int 'length') returns .slice(&length=length)\n\
Array.'stemWhere'('test') returns .slice(&end=.firstKeyWhere{.!(test)})\n\
Array.'stemUntil'(Callable 'test') returns .stem(&length=.cells.firstWhere{.value.(test)}.key)\n\
\n\
Array.'middle' returns .atEach[1 ..< .length-1]\n\
Array.'reverse' returns array(this.length) 'idx'->{ this.at(this.length-(idx+1)) }\n\
Array.'emptyOr'(Callable 'body') returns .if{==[]}{[]} else (body)\n\
Array.'singletonOr'(Callable 'body') returns .if{.length <= 1}{this} else (body)\n\
\n\
Array.'sort' returns .singletonOr\n\
{\n\
  'v' = .1st;\n\
  .tail.where{<v}.sort + [v] + .tail.where{>=v}.sort\n\
}\n\
\n\
Array.'sortBy'('property') returns .singletonOr\n\
{\n\
  'p' = .1st.(property);\n\
  .tail.where{.(property)<p}.sortBy(property) + [.1st] + .tail.where{.(property)>=p}.sortBy(property)\n\
}\n\
\n\
Array.'whereDistinct'('property') returns .singletonOr\n\
{\n\
  'p' = .1st.(property);\n\
  [.1st] + .tail.where{.(property) != p}.whereDistinct(property)\n\
}\n\
\n\
Array.'withBounds'(Callable 'bound') returns array(&length=.length) 'key'->{ this.at(key) else {key.(bound)} }\n\
Array.'safeBounds' returns .withBounds{__novalues}\n\
Array.'arrayRotate'(Int 'offset') returns .cyclic.slice(&start=offset, &length=.length)\n\
Array.'total' returns .1st + .2nd + etc;\n\
Array.'sum' returns .total\n\
Array.'product' returns .1st * .2nd * etc;\n\
Array.'total'(Callable 'body') returns total[.each.(body)]\n\
Array.'product'(Callable 'body') returns product[.each.(body)]\n\
Array.'copy' returns [.each]\n\
Anything.'in'(Array 'array') returns this ==any array\n\
\n\
Array.'pad'(Anything &'with', Int &'length') returns this + [with**(length-this.length)]\n\
Array.'prepad'(Anything &'with', Int &'length') returns [with**(length-this.length)] + this\n\
\n\
Array.'categorizeBy'(Callable 'key')\n\
{\n\
  'result' = this.map(key).tabulate{this.ElementType.mutableArray[]}\n\
  forEach(this) 'value'->\n\
  {\n\
    result.at( value.(key) ).push(value)\n\
  }\n\
  result\n\
}\n\
Array.'categorize' returns .categorizeBy{it}\n\
Array.'frequencies' returns .categorize.map{.length}\n\
Array.'min' returns .reduce ['a','b']-> { a.clamp(&max=b) }\n\
Array.'min'('else') returns if(.length>0){this.min} else (else)\n\
Array.'max' returns .reduce ['a','b']-> { a.clamp(&min=b) }\n\
Array.'max'('else') returns if(.length>0){this.max} else (else)\n\
\n\
Array.'min'('property') returns .reduce ['a','b']->\n\
{\n\
  if(a.(property) <= b.(property)){a} else {b}\n\
}\n\
\n\
Array.'max'('property') returns .reduce ['a','b']->\n\
{\n\
  if(a.(property) >= b.(property)){a} else {b}\n\
}\n\
\n\
Array.'whereMin' returns [.each.box].reduce ['a','b']->\n\
{\n\
  if (a == []) { b }\n\
  else if (b == []) { a }\n\
  else if (a.1st > b.1st) { b }\n\
  else if (a.1st < b.1st) { a }\n\
  else { a+b }\n\
}\n\
\n\
Array.'whereMax' returns [.each.box].reduce ['a','b']->\n\
{\n\
  if (a == []) { b }\n\
  else if (b == []) { a }\n\
  else if (a.1st < b.1st) { b }\n\
  else if (a.1st > b.1st) { a }\n\
  else { a+b }\n\
}\n\
\n\
Array.'whereMin'(Callable 'property') returns [.each.box].reduce ['a','b']->\n\
{\n\
  if (a == []) { b }\n\
  else if (b == []) { a }\n\
  else if(a.1st.(property) > b.1st.(property)) { b }\n\
  else if(a.1st.(property) < b.1st.(property)) { a }\n\
  else { a+b }\n\
}\n\
\n\
Array.'whereMax'(Callable 'property') returns [.each.box].reduce ['a','b']->\n\
{\n\
  if (a == []) { b }\n\
  else if (b == []) { a }\n\
  else if (a.1st.(property) < b.1st.(property)) { b }\n\
  else if (a.1st.(property) > b.1st.(property)) { a }\n\
  else { a+b }\n\
}\n\
\n\
Array.'countWhere'(Callable 'test')\n\
{\n\
  Int 'result' = 0\n\
  forEach(this){ if(.(test)){ result = result+1 } }\n\
  \n\
  return result\n\
}\n\
\n\
Array.'firstWhere'(Callable 'test')\n\
{\n\
  forEach(this){ .if(test){ return it } }\n\
  \n\
  return __novalues\n\
}\n\
\n\
Array.'firstWhere'(Callable 'test', Callable 'then')\n\
{\n\
  forEach(this){ .if(test){ return it.(then) } }\n\
  \n\
  return __novalues\n\
}\n\
\n\
Array.'firstWhere'(Callable 'test', Callable 'else')\n\
{\n\
  forEach(this){ .if(test){ return it } }\n\
  \n\
  return .(else)\n\
}\n\
\n\
Array.'firstWhere'(Callable 'test', Callable 'then', Callable 'else')\n\
{\n\
  .each.if(test){ return .(then) }\n\
  \n\
  return .(else)\n\
}\n\
\n\
Array.'lastWhere'(Callable 'test') returns .reverse.firstWhere(test)\n\
Array.'lastWhere'(Callable 'test', Callable 'else') returns .reverse.firstWhere(test) else (else)\n\
Array.'lastWhere'(Callable 'test', Callable 'then', Callable 'else') returns .reverse.firstWhere(test)(then) else (else)\n\
\n\
Array.'keysWhere'(Callable 'test') returns .cells.where{.value.(test)}.map{.key}\n\
Array.'firstKeyWhere'(Callable 'test') returns .cells.firstWhere{.value.(test)}{.key}\n\
Array.'firstKeyWhere'(Callable 'test', Callable 'else') returns .cells.firstWhere{.value.(test)}{.key} else (else)\n\
Array.'firstKeyWhere'(Callable 'test', Callable 'then', Callable 'else') returns .cells.firstWhere{.value.(test)}{.key.(then)} else (else)\n\
Array.'lastKeyWhere'(Callable 'test') returns .cells.lastWhere{.value.(test)}.key\n\
\n\
\n\
//== Cells ==\n\
'Cell' = Struct\n\
{\n\
  Anything 'key'\n\
  Container 'container'\n\
}\n\
\n\
Cell.'value' returns .container.at(.key)\n\
Cell.'value'('__mutator') returns .container.at(.key)(__mutator)\n\
Container.'cellAt'('key') returns Cell.new(&key=key, &container=this)\n\
//Cell.'$$' returns \"cell($$.key:$$.value)\"\n\
//Cell.'+'(Int 'offset') returns .container.cellAt(.key+offset)\n\
Cell.'next' returns .container.cellAt(.key+1)\n\
Cell.'prev' returns .container.cellAt(.key-1)\n\
Container.'cells'(Callable 'body') returns .cells.(body).map{.value}\n\
Array.'cells' returns array(.length) 'idx'->{ this.cellAt(idx) }\n\
Table.'cells' returns array(.keys.length) 'idx'->{ this.cellAt(this.keys.at(idx)) }\n\
Table.'cellTable' returns table(.keys) 'key'->{ this.cellAt(key) }\n\
Cell.Array.'table' returns table[.each.key](.1st.container)\n\
Cell.Array.'cellKeys' returns [.each.key]\n\
Cell.Array.'cellValues' returns [.each.value]\n\
Cell.'toSlice'(&'length') returns .container.slice(&start=.key, &length=length)\n\
Cell.'toSlice'(&'end') returns .container.slice(&start=.key, &end=end)\n\
Cell.'toSlice'(&'start') returns .container.slice(&start=start, &end=.key)\n\
Array.'fenceGaps' returns .cells.{[[.at(0), .at(1)], [.at(1), .at(2)], etc**.length-1]}\n\
\n\
Cell.Array.'split' returns .1st.container.splitAt(.map{.key})\n\
Cell.Array.'splitOut' returns .1st.container.splitOut(.cellKeys)\n\
\n\
\n\
//== Maybe==\n\
'Maybe' = Struct{ Array 'internal' }\n\
\n\
Maybe.Literal.'new'('value') returns Maybe.new( &internal=[value] )\n\
\n\
Maybe.Literal.'none' returns Maybe.new( &internal=[] )\n\
\n\
Maybe.'hasValue' returns .internal.length > 0\n\
\n\
Maybe.'value' returns .internal.each\n\
\n\
Maybe.'value'(Callable 'else') returns\n\
	if(.hasValue){.internal.1st} else (else)\n\
\n\
Maybe.'value'(Callable 'then')(Callable 'else') returns\n\
	if(.hasValue){.internal.1st.(then)} else (else)\n\
\n\
\n\
//== Mutable data ==\n\
Type.'mutableArray'(Int 'length', 'value') returns this.mutableArray[value**length]\n\
Type.'buildArray'(Callable 'body') { 'result' = .mutableArray[]; result.(body); result.copy }\n\
Array.'push'('value') { .at(.length) = value }\n\
\n\
Type.'generator'(Int 'length', 'first', Callable 'next')\n\
{\n\
  this 'curValue'=first\n\
  Int 'curIdx'=0\n\
  array(length) 'idx'->\n\
  {\n\
    if( idx < curIdx ){ curValue=first; curIdx = 0 }\n\
    while{ idx > curIdx }\n\
    {\n\
      curValue = curValue.(next)\n\
      curIdx = curIdx+1\n\
    }\n\
    curValue\n\
  }\n\
}\n\
\n\
Array.'AnyOf' returns Type(.1st)\n\
Array.'ElementType' returns .Type.ElementType\n\
Container.'KeyType' returns .keys.ElementType\n\
Anything.'assert'(Type 't') returns t<<this\n\
\n\
String.'alert' { .javascript{ alert(this) }; void }\n\
String.'log' returns Void<< .javascript{ console.log(this) }\n\
Number.'sqrt' returns Number<< .javascript{ return Math.sqrt(this) }\n\
Number.'sin' returns Number<< .javascript{ return Math.sin(this) }\n\
Number.'cos' returns Number<< .javascript{ return Math.cos(this) }\n\
//Number.'toInt' returns Int<< .javascript{ return this|0 }\n\
Number.'floor' returns Int<< .javascript{ return Math.floor(this) }\n\
Number.'ceil' returns Int<< .javascript{ return Math.ceil(this) }\n\
";/**/

/*
Array.'random'(Int 'length') = [.random, etc**length]
Array.'randomDraw'(Int 'length') = .randomSubset(length).shuffle
Array.'randomSubset'(Int 'length') = .keys.trimEnd(length).random.'k'->{ [this.at(k)] + this.slice(&start=k+1).randomSubset(length-1) }
Array.'randomSlice'(Int 'length') = .keys.trimEnd(length).random.'k'->{ this.atKeys[k ..< k+length] }
*/
/*
if( .contains(Non~Digit) )
{
  return 0;
}
else
{
  .reverse.forEach{ it-"0" }.call
  {
    .1st*1 + .2nd*10 + .3rd*100 + etc
  }
}*/

//'customTable'('at') { Table.internalNew(at:at, members:[]) }

//if ( result ) alert(result);
//SWYM.DefaultGlobalCScope = SWYM.scope;

}; // initStdlyb ends

SWYM.onLoad("swymStdlyb.js");