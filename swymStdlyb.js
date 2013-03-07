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
//          +-----------+-------+-------+-------+------+----------+----------+
//        Type        Array   Block   Table   Number  Bool  <structinst> <enuminst>
//     +----+---+       |                       |
// Struct      Enum   String                   Int
//
// Interesting issue - do we need two root objects, one for callables and one for noncallables?
// Is Array a subtype of Table? They're basically compatible, except arrays renumber their keys; tables never do. :-/
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

SWYM.NumberType = {type:"type", nativeType:"Number", debugName:"Number"};
SWYM.IntType = {type:"type", nativeType:"Number", multipleOf:1, debugName:"Int"};
SWYM.VoidType = {type:"type", nativeType:"Void", debugName:"Void"};
SWYM.TypeType = {type:"type", nativeType:"Type", argType:SWYM.AnyType, outType:SWYM.BoolType, debugName:"Type"};

SWYM.IntArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.IntType, memberTypes:{"length":SWYM.IntType}, debugName:"Array(Int)"};
SWYM.IntArrayType.memberTypes["keys"] = SWYM.IntArrayType;

SWYM.StringCharType = {type:"type", nativeType:"String", argType:SWYM.IntType, memberTypes:{"length":SWYM.BakedValue(1), "keys":SWYM.IntArrayType, "isChar":SWYM.BakedValue(true)}, debugName:"StringChar"};
SWYM.StringCharType.outType = SWYM.StringCharType;

SWYM.VariableType = {type:"type", nativeType:"Variable", contentsType:SWYM.DontCareType, debugName:"Var"};

SWYM.NativeArrayType = {type:"type", nativeType:"JSArray", argType:SWYM.IntType, outType:SWYM.AnyType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"NativeArray"};
SWYM.NativeTableType = {type:"type", nativeType:"JSObject", argType:SWYM.StringType, outType:SWYM.AnyType, memberTypes:{"keys":SWYM.ArrayType}, debugName:"NativeTable"};
SWYM.NativeStringType = {type:"type", nativeType:"JSString", argType:SWYM.IntType, outType:SWYM.StringCharType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"NativeString"};

SWYM.ArrayType = {type:"type", argType:SWYM.IntType, outType:SWYM.AnyType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"Array"};
SWYM.TableType = {type:"type", argType:SWYM.DontCareType, outType:SWYM.AnyType, memberTypes:{"keys":SWYM.ArrayType}, debugName:"Table"}; // fixme: needs "keys" member type.
SWYM.StringType = {type:"type", argType:SWYM.IntType, outType:SWYM.StringCharType, memberTypes:{"length":SWYM.IntType, "keys":SWYM.IntArrayType}, debugName:"String"};
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
	"(blank_line)":  {precedence:1, infix:true, postfix:true, prefix:true, noImplicitSemicolon:true,
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
			parentFunction.returnType = SWYM.ArrayType;
			parentFunction.bodyCScope["Yielded"] = SWYM.ArrayTypeContaining(SWYM.DontCareType);

			SWYM.pushEach(["#Load", "Yielded"], executable);
						
			var yieldType = SWYM.CompileNode(node.children[1], cscope, executable);
			if( !yieldType || yieldType.multivalueOf === undefined )
			{
				executable.push("#SingletonArray");
			}

			SWYM.pushEach(["#ConcatArrays", 2, "#Overwrite", "Yielded", "#Pop"], executable);
			
			if( parentFunction.returnType === undefined )
				parentFunction.returnType = SWYM.ArrayTypeContaining(yieldType);
			else
				parentFunction.returnType = SWYM.TypeUnify(parentFunction.returnType, SWYM.ArrayTypeContaining(yieldType));
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
	
	",":  {precedence:20, infix:true, postfix:true, noImplicitSemicolon:true,
		identity:function(){ return [] },
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
			for( var Idx = 0; Idx < args.length; ++Idx )
			{
				var executableN = [];
				var typeN = SWYM.CompileNode( args[Idx], cscope, executableN );
				
				if( bakedArray !== undefined )
				{
					if( typeN && typeN.baked !== undefined )
					{
						bakedArray.push(typeN.baked);
					}
					else
					{
						bakedArray = undefined;
					}
				}
				
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
				}
				else if ( isMulti )
				{
					executableN.push("#SingletonArray");
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
			
			if( !isMulti )
				resultType = SWYM.ToMultivalueType(resultType);

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

	"=>":  {precedence:25, infix:true,
		customCompile:function(node, cscope, executable)
		{
			SWYM.LogError(node, "'=>' can only be used within a table declaration.");
			return SWYM.VoidType;
		}
	},

	":":  {precedence:30, infix:true,
		customCompile:function(node, cscope, executable)
		{
			if( node.children[1] && node.children[1].op && node.children[1].op.text === "=" )
			{
				var equalsNode = node.children[1];
				var declName;
				if( equalsNode.children[0].type === "decl" )
				{
					// it's a variable declaration
					declName = equalsNode.children[0].value;
				}
				else if( equalsNode.children[0].type === "fnnode" && equalsNode.children[0].isDecl )
				{
					// it's a function declaration with a return type
					equalsNode.children[0].returnTypeNode = node.children[0];
					return SWYM.CompileNode(equalsNode, cscope, executable);
				}
				else if( equalsNode.children[0].type === "name" )
				{
					declName = equalsNode.children[0].text;
					SWYM.LogError(node, "Illegal declaration of "+declName+" - did you forget to 'quote' it?");
				}
				else
				{
					SWYM.LogError(node, "Invalid declaration");
				}
				
				var initialValueType = SWYM.CompileNode(equalsNode.children[1], cscope, executable);
				var varType;

				var unusedExecutable = [];
				var typeType = SWYM.CompileNode(node.children[0], cscope, unusedExecutable);				
				if( !typeType || !typeType.baked || typeType.baked.type !== "type" )
				{
					SWYM.LogError(node.children[0], "Expected a type here");
					varType = initialValueType;
				}
				else
				{
					varType = typeType.baked;
					SWYM.TypeCoerce(varType, initialValueType);
				}
				
				SWYM.CreateLocal(declName, varType, cscope, executable, node);
				cscope[declName+"##mutable"] = true;
				return varType;
			}
			else if( node.children[1].type === "fnnode" && equalsNode.children[1].isDecl )
			{
				// it's a function declaration with a return type
				node.children[1].returnTypeNode = node.children[0];
				return SWYM.CompileNode(node.children[1], cscope, executable);
			}
			else
			{
				SWYM.LogError(node, "':' is illegal in this context.");
				return SWYM.VoidType;
			}
		}
	},
	
	"=":  {precedence:45, infix:true, rightAssociative:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if ( lhs && lhs.type === "fnnode" && !lhs.isDecl )
			{
				// pass an "equals" argument to this function
				var result = {type:"fnnode", body:undefined, isDecl:undefined, name:undefined, children:[rhs], argNames:["equals"]};
				
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
				// declare a constant
				var valueType = SWYM.CompileNode(node.children[1], cscope, executable);
				
				if( SWYM.TypeMatches(SWYM.VoidType, valueType) )
				{
					SWYM.LogError(node, "Invalid declaration - can't store a Void value.");
				}
				
				SWYM.CreateLocal( node.children[0].value, valueType, cscope, executable, node );
				return valueType;
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
				
				SWYM.TypeCoerce(varType, newValueType);
				
				executable.push( "#Overwrite" );
				executable.push( node.children[0].text );
				
				return SWYM.VoidType;
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
/*			else
			{
				// ordinary assignment
				var type0 = SWYM.CompileLValue(node.children[0], cscope, executable);
				var type1 = SWYM.CompileNode(node.children[1], cscope, executable);
				
				SWYM.TypeCoerce(SWYM.VariableType, type0, node.children[0]);
				
				if( type0.multivalueOf !== undefined )
					executable.push("#MultiVariableAssign");
				else
					executable.push("#VariableAssign");
				
				return type0;
			}*/
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
				return type0;
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
			if( node.children[0] === undefined && node.children[1] === undefined )
			{
				// standalone ".." expression = minus infinity to plus infinity
				var rangeArray = SWYM.rangeArray(-Infinity, Infinity);
				executable.push("#Literal");
				executable.push(rangeArray);
				return SWYM.MultivalueRangeType;
			}
			if( node.children[1] === undefined )
			{
				// a.. expression = a to plus infinity
				var type0 = SWYM.CompileNode( node.children[0], cscope, executable );
				SWYM.TypeCoerce(SWYM.IntType, type0, node.children[0]);
				executable.push("#Native");
				executable.push(1);
				executable.push( function(a){ return SWYM.rangeArray(a, Infinity) });
				return SWYM.MultivalueRangeType;
			}
			if( node.children[0] === undefined )
			{
				// ..b expression = minus infinity to b
				var type1 = SWYM.CompileNode( node.children[1], cscope, executable );
				SWYM.TypeCoerce(SWYM.IntType, type1, node.children[1]);
				executable.push("#Native");
				executable.push(1);
				executable.push( function(b){ return SWYM.rangeArray(-Infinity, b) });
				return SWYM.MultivalueRangeType;
			}

			
			var type0 = SWYM.CompileNode( node.children[0], cscope, executable );
			if( SWYM.TypeMatches(SWYM.IntType, type0 ) )
			{
				var type1 = SWYM.CompileNode( node.children[1], cscope, executable );
				if( SWYM.TypeMatches(SWYM.IntType, type1 ) )
				{
					executable.push("#Native");
					executable.push(2);
					executable.push( function(a,b){ return SWYM.RangeOp(a,b, true, true, undefined) });
					return SWYM.MultivalueRangeType;
				}
				else
				{
					SWYM.LogError(node, "Inconsistent arguments for '..' operator: "+SWYM.TypeToString(type0)+" and "+SWYM.TypeToString(type1));
					return;
				}
			}
			
			type0 = SWYM.TypeCoerce(SWYM.StringType, type0, node.children[0]);
			var type1 = SWYM.CompileNode( node.children[1], cscope, executable );
			type1 = SWYM.TypeCoerce(SWYM.StringType, type1, node.children[1]);

			executable.push("#Native");
			executable.push(2);
			executable.push( function(a,b){ return SWYM.CharRange(a,b) });
			return SWYM.ToMultivalueType(SWYM.StringCharType);
		}},
	// ascending sequence that includes left, right, neither or both endpoints
	"..<": {precedence:75, argTypes:[SWYM.IntType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, false, 1); }, prefix:function(b){ return SWYM.rangeArray(-Infinity,b-1);} },
	"..<=": {precedence:75, argTypes:[SWYM.IntType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, 1); }, prefix:function(b){ return SWYM.rangeArray(-Infinity,b);} },
	"<..": {precedence:75, argTypes:[SWYM.NumberType,SWYM.IntType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, false, true, 1); }, postfix:function(a){ return SWYM.rangeArray(a+1,Infinity);} },
	"<..<":{precedence:75, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, false, false, 1); }},
	"..<..":{precedence:75, argTypes:[SWYM.IntType,SWYM.IntType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, 1); }},
	// descending sequence that excludes left, right, neither or both endpoints
	"..>": {precedence:75, argTypes:[SWYM.IntType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, false, -1); }},
	">..": {precedence:75, argTypes:[SWYM.NumberType,SWYM.IntType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, false, true, -1); }},
	">..>":{precedence:75, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, false, false, -1); }},
	"..>..":{precedence:75, argTypes:[SWYM.IntType,SWYM.IntType], returnType:SWYM.MultivalueRangeType, infix:function(a,b){ return SWYM.RangeOp(a,b, true, true, -1); }},
	
	"==": {precedence:80, returnType:SWYM.BoolType, infix:SWYM.IsEqual },
	"!=": {precedence:80, returnType:SWYM.BoolType, infix:function(a,b){return !SWYM.IsEqual(a,b)}},

	// 'exactly equal' operators - useful?
	"===": {precedence:80, returnType:SWYM.BoolType, infix:function(a,b){ return SWYM.IsEqual(a,b,true) }},
	"!==": {precedence:80, returnType:SWYM.BoolType, infix:function(a,b){return !SWYM.IsEqual(a,b,true)}},

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

	">": {precedence:81, infix:true, customParseTreeNode:SWYM.OverloadableOperatorParseTreeNode(">") },
	">=": {precedence:81, infix:true, customParseTreeNode:SWYM.OverloadableOperatorParseTreeNode(">=") },
	"<": {precedence:81, infix:true, customParseTreeNode:SWYM.OverloadableOperatorParseTreeNode("<") },
	"<=": {precedence:81, infix:true, customParseTreeNode:SWYM.OverloadableOperatorParseTreeNode("<=") },
	
/*	">":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.BoolType, infix:function(a,b){return a>b} },
	">=": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.BoolType, infix:function(a,b){return a>=b} },
	"<":  {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.BoolType, infix:function(a,b){return a<b} },
	"<=": {precedence:81, argTypes:[SWYM.NumberType,SWYM.NumberType], returnType:SWYM.BoolType, infix:function(a,b){return a<=b} },
*/
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

	"+": {precedence:102, infix:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			// The + operator just ends up calling the + function. ("fn#+", below.)
			return {type:"fnnode", body:undefined, isDecl:false,
				name:"+",
				pos:op.pos,
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
							executable2.push("#SingletonArray");
							type2 = SWYM.ToMultivalueType(type2);
							var resultType = SWYM.ToMultivalueType(SWYM.ArrayTypeContaining(SWYM.TypeUnify(type1.multivalueOf.outType, type2.outType, "+ operator arguments")));
						}
						else if ( !(type1 && type1.multivalueOf !== undefined) )
						{
							executable1.push("#SingletonArray");
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
				var addArgsTo;
				if( rhs && rhs.addArgsTo !== undefined )
					addArgsTo = rhs.addArgsTo;
				else
					addArgsTo = rhs;
					
				return {type:"fnnode", addArgsTo:addArgsTo, pos:lhs.pos, body:undefined, isDecl:false, name:lhs.text, children:[rhs], argNames:["__"]};
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

			var result = {type:"fnnode", pos:op.pos, body:undefined, isDecl:undefined, name:undefined, children:[rhs], argNames:["else"]};
			return SWYM.CombineFnNodes(lhs, result);
		}
	},
	
	"(": { precedence:330, takeCloseBracket:")", prefix:true, infix:true, debugText:"parenth", noImplicitSemicolon:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs )
				return SWYM.NonCustomParseTreeNode(lhs, op, rhs);

			// function call
			var params = {type:"fnnode", pos:lhs.pos, body:undefined, isDecl:undefined, name:undefined, children:[], argNames:[]};
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
				return {type:"swymObject", ofClass:SWYM.ArrayClass, outType:SWYM.DontCareType, baked:emptyList};
			}
			else
			{
				// list expression
				var type = SWYM.CompileNode(node.children[1], cscope, executable);

				if( !type || type.multivalueOf === undefined )
				{
					// wrap single values in a list
					executable.push( "#SingletonArray" );
					return SWYM.ArrayTypeContaining( type );
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
					// if the multivalue is a mutable array, make an immutable copy of it
					executable.push("#CopyArray");
					return SWYM.ArrayTypeContaining( type );
				}
				else
				{
					// otherwise, just reinterpret it back into an array (no-op)
					return SWYM.ArrayTypeContaining( type );
				}
			}
		}
	},
	"{": { precedence:330, takeCloseBracket:"}", prefix:true, infix:true, debugText:"curly", noImplicitSemicolon:true,
		customParseTreeNode:function(lhs, op, rhs)
		{
			if( !lhs )
				return SWYM.NonCustomParseTreeNode(lhs, op, rhs);

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
	"void": {type:"type", nativeType:"Void", debugName:"Void", baked:null},
	
	"Callable": SWYM.BakedValue(SWYM.CallableType),
	"Type": SWYM.BakedValue(SWYM.TypeType),
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

	// these two are redundant, they should be indistinguishable from a user's perspective. The only reason they're both here is for testing purposes.
	"novalues": {type:"type", multivalueOf:{type:"type", nativeType:"NoValues"}, baked:SWYM.jsArray([])},
	"value_novalues": SWYM.BakedValue(SWYM.value_novalues),
	
	// an implementation detail - here for testing, but should not be exposed to users.
	"StringChar": SWYM.BakedValue(SWYM.StringCharType),
	
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
	
	"fn#Literal":
	[{
		expectedArgs:{"this":{index:0, typeCheck:SWYM.AnyType}},
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable, argExecutables)
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
		customCompile:function(argTypes, cscope, executable, argExecutables)
		{
			var result = argTypes[0];
			
			executable.push("#Literal");
			executable.push(result);
			
			return SWYM.BakedValue(result);
		},
		multiCustomCompile:function(argTypes, cscope, executable, argExecutables)
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
			"this":{index:0, typeCheck:SWYM.DontCareType},
			"test":{index:1, typeCheck:SWYM.CallableType},
			"then":{index:2, typeCheck:SWYM.CallableType},
			"else":{index:3, typeCheck:SWYM.CallableType}
		},
		customCompile:function(argTypes, cscope, executable, errorContext)
		{
			var isMulti = (argTypes[0] && argTypes[0].multivalueOf !== undefined) ||
						(argTypes[1] && argTypes[1].multivalueOf !== undefined) || 
						(argTypes[2] && argTypes[2].multivalueOf !== undefined) ||
						(argTypes[3] && argTypes[3].multivalueOf !== undefined);
			
			var selfType = SWYM.ToSinglevalueType(argTypes[0]);
			var condType = SWYM.GetOutType(SWYM.ToSinglevalueType(argTypes[1]), selfType);
			
			var bodyType = selfType;
			if( argTypes[1] && argTypes[1].baked && argTypes[1].baked.type === "type" )
			{
				bodyType = SWYM.TypeIntersect(selfType, argTypes[1].baked, errorContext);
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

	"fn#javascript":
	[{
		expectedArgs:{ "argList":{index:0, typeCheck:SWYM.BlockType}, "body":{index:1, typeCheck:SWYM.BlockType} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable)
		{
			if( !argTypes[0].baked && (!argTypes[0].needsCompiling || argTypes[0].needsCompiling.length !== 1) )
			{
				SWYM.LogError(0, "The body of a javascript literal must be known at compile time!");
				return undefined;
			}
			
			var argsNode = argTypes[0].baked? argTypes[0].baked.bodyNode: argTypes[0].needsCompiling[0].bodyNode;
			var typeNodes = [];
			var nameNodes = [];
			var defaultValueNodes = [];
			SWYM.CollectClassMembers(argsNode, typeNodes, nameNodes, defaultValueNodes);
			
			var argNameList = []
			for( var Idx = 0; Idx < nameNodes.length; ++Idx )
			{
				argNameList.push( nameNodes[Idx].value );
			}
						
			for( var Idx = 0; Idx < defaultValueNodes.length; ++Idx )
			{
				var argType;
				if( defaultValueNodes[Idx] !== undefined )
				{
					argType = SWYM.CompileNode(defaultValueNodes[Idx], cscope, executable);
				}
				else if( cscope[argNameList[Idx]] !== undefined )
				{
					argType = cscope[argNameList[Idx]];
					executable.push("#Load");
					executable.push(argNameList[Idx]);
				}
				else
				{
					SWYM.LogError(nameNodes[Idx], "Undefined argument '"+argNameList[Idx]+"'");
				}
				
				if( SWYM.TypeMatches(SWYM.StringType, argType) )
				{
					executable.push("#Native")
					executable.push(1)
					executable.push(function(str){ return str.data; })
				}
			}

			//FIXME: this is pretty half-assed. javascript parsing uses quite different rules from swym.
			// To do this right, we ought to have switched into javascript mode way back in the tokenizer.
			var functionText = "var jsFunction = function("+argNameList+")"+argTypes[1].needsCompiling[0].executableBlock.debugText;
			eval(functionText);

			executable.push("#Native");
			executable.push(defaultValueNodes.length);
			executable.push(jsFunction);
			
			return SWYM.DontCareType;
		}
	}],
	
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

	"fn#length":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
			returnType:SWYM.IntType,
			nativeCode:function(value){  return value.length;  } 
		}],
		
	"fn#Var":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.TypeType} },
			customCompileWithoutArgs:true,
			customCompile:function(argTypes, cscope, executable, argExecutables)
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

	"fn#var":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.TypeType}, "equals":{index:1} },
			customCompileWithoutArgs:true,
			customCompile:function(argTypes, cscope, executable, argExecutables)
			{
				if ( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
				{
					SWYM.LogError(0, "The first argument to 'var' must be a type.");
					return SWYM.VariableTypeContaining(SWYM.AnyType);
				}
				else
				{
					var varType = argTypes[0].baked;
					SWYM.TypeCoerce(varType, argTypes[1]); //TODO: missing error info!
					
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
						"equals":{index:2} },
			returnType:SWYM.VoidType,
			customTypeCheck:function(argTypes)
			{
				if( argTypes[0] && !SWYM.TypeMatches(argTypes[0].outType, argTypes[2]) )
				{
					return "Cannot store values of type "+SWYM.TypeToString(argTypes[2])+" in an array of type "+SWYM.TypeToString(argTypes[0].outType);
				}
				return true;
			},
			nativeCode:function(array, key, equals)
			{
				array[key] = equals;
			}
		}],

	"fn#value":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.VariableType} },
			customCompile:function(argTypes, cscope, executable)
			{
				executable.push("#VariableContents");
				return SWYM.GetVariableTypeContents(argTypes[0]);
			}
		},
		{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.VariableType}, "equals":{index:1} },
			returnType:SWYM.VoidType,
			customCompile:function(argTypes, cscope, executable)
			{
				SWYM.TypeCoerce(argTypes[0].contentType, argTypes[1]); //TODO: missing error info!
				executable.push("#VariableAssign");
			}
		}],

	"fn#mutableArray":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.TypeType}, "equals":{index:1, typeCheck:SWYM.ArrayType} },
			customCompileWithoutArgs:true,
			customCompile:function(argTypes, cscope, executable, argExecutables)
			{
				if ( !argTypes[0] || !argTypes[0].baked || argTypes[0].baked.type !== "type" )
				{
					SWYM.LogError(0, "The first argument to 'mutableArray' must be a type.");
					return SWYM.ArrayTypeContaining(SWYM.AnyType, true);
				}
				else
				{
					var varType = argTypes[0].baked;
					SWYM.TypeCoerce(varType, argTypes[1].outType); //TODO: missing error info!

					SWYM.pushEach(argExecutables[1], executable);
					executable.push("#CopyArray");

					return SWYM.ArrayTypeContaining(varType, true);
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
		customCompile:function(argTypes, cscope, executable, argExecutables)
		{
			var returnType = SWYM.GetOutType( argTypes[1], argTypes[0] );
			SWYM.CompileClosureCall(argTypes[0], argExecutables[0], argTypes[1], argExecutables[1], cscope, executable);
			return returnType;
		},
		multiCustomCompile:function(argTypes, cscope, executable, argExecutables)
		{
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
			var resultType = SWYM.GetOutType( SWYM.ToSinglevalueType(argTypes[1]), SWYM.ToSinglevalueType(argTypes[0]));
			
			// FIXME: subtle bug - if both arguments are quantifiers, and they were supplied in the opposite order,
			// we ought to be processing them in the opposite order.
			if( argTypes[0].multivalueOf )
			{
				resultType = SWYM.ToMultivalueType( resultType, argTypes[0].quantifier );
			}
			if( argTypes[1].multivalueOf )
			{
				resultType = SWYM.ToMultivalueType( resultType, argTypes[1].quantifier );
			}
			return resultType;
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
			return SWYM.ToMultivalueType(SWYM.GetOutType( argTypes[0], SWYM.VoidType ));
		}
	}],

	"fn#each":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable) { return SWYM.ArrayToMultivalueType(argTypes[0]); }, // each is basically a no-op!
	}],
	
	"fn#some":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable) { return SWYM.ArrayToMultivalueType(argTypes[0], ["OR"]); }, // no-op!
	}],

	"fn#all":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable) { return SWYM.ArrayToMultivalueType(argTypes[0], ["AND"]); }, // no-op!
	}],

	"fn#none":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable) { return SWYM.ArrayToMultivalueType(argTypes[0], ["NOR"]); }, // no-op!
	}],

	"fn#lazy":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable) { return SWYM.LazyArrayTypeContaining(SWYM.GetOutType(argTypes[0])); }, // no-op!
	}],

	"fn#eager":[{ expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompile:function(argTypes, cscope, executable) { return SWYM.ArrayTypeContaining(SWYM.GetOutType(argTypes[0])); }, // no-op!
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
	
	"fn#isLazy":[{  expectedArgs:{ "this":{index:0, typeCheck:SWYM.ArrayType} },
		customCompileWithoutArgs:true,
		customCompile:function(argTypes, cscope, executable)
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
		customCompile:function(argTypes, cscope, executable)
		{
			var elementType = SWYM.GetOutType(argTypes[1], SWYM.IntType);
			executable.push("#Native");
			
			if( argTypes[2] === undefined )
				executable.push(2);
			else
				executable.push(3);

			if( elementType && elementType.multivalueOf !== undefined )
			{
				SWYM.LogError(0, "Invalid array constructor - element type cannot be a multivalue");
			}
			else
			{
				executable.push(function(len, lookup, lazy)
				{
					return {
						type:"lazyArray",
						length:len,
						run:function(key) {return SWYM.ClosureCall(lookup,key);}
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
		customCompile:function(argTypes, cscope, executable, argExecutables)
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
				SWYM.LogError(0, "Fsckup: no keys defined for ostensible Table type");
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


	"fn#while":[{ expectedArgs:{ "test":{index:0, typeCheck:SWYM.CallableType}, "body":{index:1, typeCheck:SWYM.CallableType} },
		returnType:SWYM.VoidType,
		customCompile:function(argTypes, cscope, executable)
		{
			executable.push("#Native");
			executable.push(2);
			executable.push(function(test, body)
			{
				while( SWYM.ClosureCall(test) != false )
				{
					SWYM.ClosureCall(body);
				}
			});

			SWYM.TypeCoerce(SWYM.BoolType, SWYM.GetOutType(argTypes[0], SWYM.VoidType));
			SWYM.GetOutType(argTypes[1], SWYM.VoidType);
			return SWYM.VoidType;
		}
	}],
}

//SWYM.stdlyb = "";

SWYM.stdlyb =
"\
//Swym loads this library by default, to implement various useful Swym constants\n\
//and functions.  The code is not exactly pretty right now. :-/\n\
//NB: some built-in native functions (such as 'input', 'output',\n\
//'random', 'length', 'do', 'each', 'array', 'javascript', etc) plus a few special\n\
//constants that cannot be bootstrapped ('true', 'false' and 'novalues'),\n\
//are not defined here.\n\
\n\
//Default operator overloads\n\
Int: Int.'+'(Int:'rhs') = javascript{'lhs'=this, 'rhs'}{ return lhs+rhs };\
Number: Number.'+'(Number:'rhs') = javascript{'lhs'=this, 'rhs'}{ return lhs+rhs };\
Array.'+'(Array:'arr') = [.each, arr.each];\
Bool: Number.'<'(Number:'rhs') = javascript{'lhs'=this, 'rhs'}{ return lhs<rhs };\
Bool: String.'<'(String:'rhs') = javascript{'lhs'=this, 'rhs'}{ return lhs<rhs };\
\n\
Array.'atEnd'('idx') {.at(.length-1-idx)};\
Array.'#st' {.at(#-1)};\
Array.'#nd' {.at(#-1)};\
Array.'#rd' {.at(#-1)};\
Array.'#th' {.at(#-1)};\
Table.'at'('key') = key.(this);\
Array.'at'('idx','else') = .if{ key.in(.keys) }{.at(key)} else (else);\
Table.'at'('key','else') = .if{ key.in(.keys) }{ .at(key) } else (else);\
Array.'atEach'(Int.Array:'keys') = [ this.at(keys.each~where{ .in(this.keys) }) ];\
Array.'keys' = [0..<.length];\
Array.'#st'('else') {.at(#-1) else(else)};\
Array.'#nd'('else') {.at(#-1) else(else)};\
Array.'#rd'('else') {.at(#-1) else(else)};\
Array.'#th'('else') {.at(#-1) else(else)};\
Array.'#stLast' {.atEnd(#-1)};\
Array.'#ndLast' {.atEnd(#-1)};\
Array.'#rdLast' {.atEnd(#-1)};\
Array.'#thLast' {.atEnd(#-1)};\
Array.'last' = .atEnd(0);\
Anything.'box' = [this];\
'pair'('a')('b') = [a,b];\
Anything.'of' = this;\
'for'('v')('fn') = v.(fn);\
Anything.'is'('fn') = .(fn);\
Anything.'print' = output($this);\
Anything.'println' = output(\"$this\\n\");\
Anything.'trace' = output(\"$$this\\n\");\
Array.'flatten' = [ .each.each ];\
'Cell' = Struct{'key','array'};\
Cell.'value' = .array.at(.key);\
Cell.'value'('equals') = .array.at(.key)=equals;\
Cell.'nextCell' = Cell.new(.key+1, .array);\
Cell.'previousCell' = Cell.new(.key-1, .array);\
Array.'cells' = array(.length) 'idx'->{ Cell.new(idx, this) };\
Cell.Array.'table' = table[.each.key](.1st.array);\
Cell.Array.'cellKeys' = [.each.key];\
Cell.Array.'cellValues' = [.each.value];\
Array.'each'('fn') = [.each.(fn)];\
'forEach'('list')('fn') = [ list.each.(fn) ];\
'forEach_lazy'('list')('fn') = array(length=.length){ list.at(it).(fn) };\
'if'(Bool:'cond', 'then', 'else') = void.if{ cond }{ do(then) } else { do(else) };\
'if'(Bool:'cond', 'then') = void.if{ cond }{ do(then) } else {};\
Anything.'if'(Callable:'test', 'then') = .if(test)(then) else {it};\
Anything.'if'(Callable:'test', 'else') = .if(test){it} else (else);\
Anything.'if'(Callable:'test') = .if(test){it} else {novalues};\
Array.'contains'(Block:'test') = .1st.(test) || .2nd.(test) || etc;\
Array.'where'('test') = forEach(this){ .if(test) };\
Array.'where'('test')('body') = forEach(this){ .if(test)(body) else {novalues}  };\
Array.'where'('test', 'body', 'else') = forEach(this){ .if(test)(body) else (else) };\
Array.'whereKey'('test') = forEach(.keys){ .if(test)(this) else {novalues} };\
Array.'whereKey'('test', 'body') = forEach(.keys){ .if(test){.(this).(body)} else {novalues} };\
Array.'whereKey'('test', 'body', 'else') = forEach(.keys){ .if(test){.(this).(body)} else {.(this).(else)} };\
Array.'starting'(Int:'n') = .atEach[0..<n];\
Array.'ending'(Int:'n') = .atEach[ (.length-n).clamp(min=0) ..< .length];\
Array.'slice'(Int:'start') = .atEach[start ..< .length];\
Array.'slice'(Int:'length') = .atEach[0..<length];\
Array.'slice'(Int:'end') = .atEach[0..<end];\
Array.'slice'(Int:'last') = .atEach[0..last];\
Array.'slice'(Int:'trimEnd') = .atEach[0 ..< .length-trimEnd];\
Array.'slice'(Int:'start',Int:'end') = .atEach[start..<end];\
Array.'slice'(Int:'start',Int:'last') = .atEach[start..last];\
Array.'slice'(Int:'start',Int:'length') = .atEach[start..<start+length];\
Array.'slice'(Int:'length',Int:'end') = .atEach[end-length..<end];\
Array.'slice'(Int:'length',Int:'last') = .atEach[last-length-1..last];\
Array.'slice'(Int:'start',Int:'trimEnd') = .atEach[start ..< .length-trimEnd];\
Array.'slice'(Int:'length',Int:'trimEnd') = .atEach[.length-length-fromEnd ..< .length-trimEnd];\
Array.'slice'['a'..<'b'] = [ .at(a.clamp(min=0)..<b.clamp(max=.length)) ];\
Array.'slices'(Int:'length') = array(.length+1-length) 'start'->{ this.slice(start=start, end=start+length) };\n\
Array.'slices' = [ .slices(length=1 .. .length).each ];\
Array.'trimStart'(Int:'n') = .atEach[n ..< .length];\
Array.'trimEnd'(Int:'n') = .atEach[0 ..< .length-n];\
Array.'startsWith'(Array:'list') = .length >= list.length && .starting(list.length) == list;\
Array.'endsWith'(Array:'list') = .length >= list.length && .ending(list.length) == list;\
Array.'splitAt'(Int:'n') = [ .slice(end=n), .slice(start=n) ];\
Array.'splitAt'(Int.Array:'keys') = if(keys == []){ this } else\n\
{[\n\
  .slice[..<keys.1st]\n\
  .slice[keys.1st..<keys.2nd], .slice[keys.2nd..<keys.3rd], etc\n\
  .slice[keys.last..]\n\
]}\n\
Cell.Array.'split' = .1st.context.splitAt(.cellKeys);\
Array.'splitWhere'(Callable:'test') = .cells.where{.value.(test)}.split;\
Array.'splitOut'(Int.Array:'keys') = [-1, keys.each, .length].{[this.slice(start=.1st+1, end=.2nd), this.slice(start=.2nd+1, end=.3rd), etc]};\
Cell.Array.'splitOut' = .1st.context.splitOut(.cellKeys);\
Array.'splitOutWhere'(Callable:'test') = .cells.where{.value.(test)}.splitOut;\
Array.'splitAtEnd'(Int:'n') = [ .slice(trimEnd=n), .ending(n) ];\
Array.'tail' = .atEach[1 ..< .length];\
Array.'stem' = .atEach[0 ..< .length-1];\
Array.'middle' = .atEach[1 ..< .length-1];\
Array.'reverse' = array(this.length) 'idx'->{ this.at(this.length-(idx+1)) };\
Array.'emptyOr'(Callable:'body') = .if{==[]}{[]} else (body);\
Array.'singletonOr'(Callable:'body') = .if{.length <= 1}{this} else (body);\n\
Array.'sort' = .singletonOr\n\
{\n\
  'v' = .1st;\n\
  .tail.where{<v}.sort + [v] + .tail.where{>=v}.sort\n\
};\n\
Array.'sortBy'('property') = .singletonOr\n\
{\n\
  'p' = .1st.(property);\n\
  .tail.where{.(property)<p}.sortBy(property) + [.1st] + .tail.where{.(property)>=p}.sortBy(property)\n\
};\n\
Array.'whereDistinct'('property') = .singletonOr\n\
{\n\
  'p' = .1st.(property);\n\
  [.1st] + .tail.where{.(property) != p}.whereDistinct(property)\n\
};\n\
Array.'withBounds'('bound') = array(length=.length) 'key'->{ this.at(key) else (key.(bound)) };\
Array.'safeBounds' = .withBounds{novalues};\
Array.'cyclic' = .withBounds{ this.at( it%this.length ) };\
Array.'total' = .1st + .2nd + etc;\
Array.'sum' = .total;\
Array.'product' = .1st * .2nd * etc;\
Array.'map'('body') = [.each.(body)];\
Array.'copy' = [.each];\
Anything.'in'('array') { ==any array };\
Number.'clamp'(Number:'min') = if(this < min){ min } else { this };\
Number.'clamp'(Number:'max') = if(this > max){ max } else { this };\
Number.'clamp'(Number:'min', Number:'max') = .clamp(min=min).clamp(max=max);\
Array.'min' = .reduce ['a','b']-> { a.clamp(max=b) };\
Array.'min'('else') = if(.length>0){this.min} else (else);\
Array.'max' = .reduce ['a','b']-> { a.clamp(min=b) };\
Array.'min'('property') = .reduce ['a','b']-> { if(a.(property) <= b.(property)){a} else {b} };\
Array.'max'('property') = .reduce ['a','b']-> { if(a.(property) >= b.(property)){a} else {b} };\
Array.'whereMin' = [.each.box].reduce['a','b'] -> { if(a == []){ b } else if(b == []){ a } else if(a.1st > b.1st){ b } else if(a.1st < b.1st){ a } else { a+b } };\
Array.'whereMax' = [.each.box].reduce['a','b'] -> { if(a == []){ b } else if(b == []){ a } else if(a.1st < b.1st){ b } else if(a.1st > b.1st){ a } else { a+b } };\
Array.'whereMin'('property') = [.each.box].reduce['a','b'] -> { if(a == []){ b } else if(b == []){ a } else if(a.1st.(property) > b.1st.(property)){ b } else if(a.1st.(property) < b.1st.(property)){ a } else { a+b } };\
Array.'whereMax'('property') = [.each.box].reduce['a','b'] -> { if(a == []){ b } else if(b == []){ a } else if(a.1st.(property) < b.1st.(property)){ b } else if(a.1st.(property) > b.1st.(property)){ a } else { a+b } };\
Array.'firstWhere'('test') { .each.if(test){ return it }; return novalues; };\
Array.'firstWhere'('test', 'else') { .each.if(test){ return it }; return .(else) };\
Array.'firstWhere'('test', 'then', 'else') { .each.if(test){ return .(then) }; return .(else) };\
Array.'lastWhere'('test') = .reverse.firstWhere(test);\
Array.'lastWhere'('test', 'else') = .reverse.firstWhere(test) else (else);\
Array.'lastWhere'('test', 'then', 'else') = .reverse.firstWhere(test)(then) else (else);\
Number.'s_plural' = if(this==1) {\"\"} else {\"s\"};\
'var'('init') = Anything.var(init);\
'Empty' = {.length == 0};\
'PI' = 3.1415926535897926;\
Block.'Non' = {!.(this)};\
Number.'neg' = -this;\
Number.'degToRad' = this*PI/180;\
Number.'radToDeg' = this*180/PI;\
Number.'abs' = if(this>=0){ this } else { -this };\
Number.'differenceFrom'('n') = abs(this-n);\
Number.'divisibleBy'('n') = this%n == 0;\
String.'toInt' = .each.{\"0\":0, \"1\":1, \"2\":2, \"3\":3, \"4\":4, \"5\":5, \"6\":6, \"7\":7, \"8\":8, \"9\":9}.[].{ .1stLast*1 + .2ndLast*10 + .3rdLast*100 + etc };\
String.'lines' = .splitOutWhere{==\"\\n\"};\
String.'words' = .splitOutWhere{==any \" \\t\\n\"};\
Anything.'case'(Table:'body') = body.at(this);\
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
};\n\
Array.'no' = yield .none;\
Array.'oneOrMore' = yield .some;\
Array.'all'('body') = [.all.(body)];\
Array.'some'('body') = [.some.(body)];\
Array.'none'('body') = [.none.(body)];\
Array.'no'('body') = [.no.(body)];\
Anything.'or_if'('test')('body') = .if(test)(body) else {this};\
Type.'mutableArray'(Int:'length', 'equals') = this.mutableArray[equals**length];\
Array.'AnyOf' = Type~of(.1st);\
\n\
Void: String.'alert' = javascript{'value'=this}{ alert(value) };\
Number: Number.'sqrt' = javascript{'value'=this}{ return Math.sqrt(value) };\
Number: Number.'sin' = javascript{'value'=this}{ return Math.sin(value) };\
Number: Number.'cos' = javascript{'value'=this}{ return Math.cos(value) };\
Int: Number.'floor' = javascript{'value'=this}{ return Math.floor(value) };\
Int: Number.'ceiling' = javascript{'value'=this}{ return Math.ceiling(value) };\
String: String.'lowercase' = javascript{'value'=this}{ return SWYM.StringWrapper(value.toLowerCase()) };\
String: String.'uppercase' = javascript{'value'=this}{ return SWYM.StringWrapper(value.toUpperCase()) };\
";/**/

//Number: Number.'cos' = javascript{'x'=this}{ return cos(x); };\


/*
Array.'random'(Int:'length') = [.random, etc**length]
Array.'randomDraw'(Int:'length') = .randomSubset(length).shuffle
Array.'randomSubset'(Int:'length') = .keys.trimEnd(length).random.'k'->{ [this.at(k)] + this.slice(start:k+1).randomSubset(length-1) }
Array.'randomRange'(Int:'length') = .keys.trimEnd(length).random.'k'->{ this.atKeys[k ..< k+length] }
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
