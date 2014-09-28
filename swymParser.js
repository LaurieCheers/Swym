
SWYM.Parse = function(tokenlist)
{
	SWYM.tokenlist = tokenlist;
	SWYM.tokenIdx = 0;
	SWYM.curToken = SWYM.tokenlist[0];
	
	var parsetree = SWYM.ParseLevel(0);
	
	if( SWYM.curToken !== undefined )
	{
		SWYM.LogError(SWYM.curToken.pos, "Unexpected token \""+SWYM.curToken.text+"\"");
	}
	
	parsetree = SWYM.FindAndProcessEtc(parsetree, 0);
    return parsetree;//SWYM.ParseTreePostProcess(parsetree);
}

//=============================================================

SWYM.NextToken = function(step)
{
	SWYM.tokenIdx+=(step?step:1);
	SWYM.curToken = SWYM.tokenlist[SWYM.tokenIdx];
}

//=============================================================

SWYM.PeekNextToken = function(offset)
{
	if( offset !== undefined )
	{
		return SWYM.tokenlist[SWYM.tokenIdx+offset];
	}
	else
	{
		return SWYM.tokenlist[SWYM.tokenIdx+1];
	}
}

//=============================================================

SWYM.ParseLevel = function(minpriority, openBracketOp)
{
	var curLhs = undefined;
	var curOp = undefined;
	
	var HandleAddOp = function(newOp, isImplicit)
	{
		var newOpNeedsLhs = !newOp.behaviour.prefix && !newOp.behaviour.standalone;
		var newOpCanHaveLhs = newOp.behaviour.postfix || newOp.behaviour.infix;

		if ( curOp )
		{
			// we're getting two operators in a row: which should be the infix one?
			var curPrecedence = curOp.behaviour.precedence;
			
			if( curOp.etc === "etc" )
			{
				var curOpNeedsRhs = false;
				var curOpCanHaveRhs = false;
			}
			else
			{
				var curOpNeedsRhs = curLhs? (!curOp.behaviour.postfix): (!curOp.behaviour.standalone);
				var curOpCanHaveRhs = curLhs? curOp.behaviour.infix: curOp.behaviour.prefix;
			}
			
			if ( !curOpCanHaveRhs && !newOpCanHaveLhs && !newOp.followsBreak ) // no error if the newOp is on the next line; we'll insert a semicolon.
			{
                SWYM.LogError(newOp.pos, "Expected: operator between '"+curOp.text+" and "+newOp.text+"'");
                if ( !isImplicit ) SWYM.NextToken();
                return undefined;
			}
			else if ( curOpNeedsRhs && newOpNeedsLhs )
			{
				// invalid - we can't satisfy both
				if ( curPrecedence > newOp.behaviour.precedence )
					SWYM.LogError(curOp.pos, "Expected: value after operator '"+curOp.text+"'");
				else
					SWYM.LogError(newOp.pos, "Expected: value before operator '"+newOp.text+"'");
				
				if ( !isImplicit ) SWYM.NextToken();
				return undefined;
			}
			else if ( curOpNeedsRhs || (curOpCanHaveRhs && !newOpCanHaveLhs) ||
					 (curOpCanHaveRhs && !newOpNeedsLhs && curPrecedence < newOp.behaviour.precedence) )
			{
				// curOp is infix, newOp is prefix
				// (...) curOp (newOp ...)
				if( curOp.behaviour.rightAssociative )
					curLhs = SWYM.ParseTreeNode(curLhs, curOp, SWYM.ParseLevel(curPrecedence));
				else
					curLhs = SWYM.ParseTreeNode(curLhs, curOp, SWYM.ParseLevel(curPrecedence+1));
				curOp = undefined;
				return undefined;
			}
			else
			{
				// curOp is postfix, newOp is infix
				// (... curOp) newOp (...)
				curLhs = SWYM.ParseTreeNode(curLhs, curOp, undefined);
				curOp = undefined;
				//...now fall through into the "no operator" section.
			}
		}

		// no operator yet - so this is adding one
		if( !curLhs && newOpNeedsLhs )
		{
			SWYM.LogError(newOp.pos, "Expected: value before operator '"+newOp.text+"'");
		}
		else if ( curLhs && newOp.followsBreak && !newOpNeedsLhs && !curOpNeedsRhs && !newOp.behaviour.noImplicitSemicolon )
		{
			// auto-insert the blank_line operator.
			var result = HandleAddOp( SWYM.NewToken("op", SWYM.curToken.sourcePos, "(blank_line)"), true );
			if ( result ) { return result; }

			// then try adding the op again.
			result = HandleAddOp(newOp);
			if ( result ) { return result; }
		}
		else if( curLhs && !newOpCanHaveLhs )
		{
			SWYM.LogError(newOp.pos, "Expected: line break or ; before operator '"+newOp.text+"'");
		}
		else if ( curLhs && newOp.behaviour.precedence < minpriority && (!newOp.behaviour.leftAssociative || newOp.behaviour.precedence+1 < minpriority) )
		{
			// the precedence is too low to handle here, throw it to the outer layer
			return {value:curLhs};
		}
		else
		{
            //finally, register the new operator.
			curOp = newOp;
			if ( !isImplicit ) SWYM.NextToken();
            
			if( newOp.behaviour.takeCloseBracket )
			{
				var rhs = SWYM.ParseLevel(0, newOp);

				if ( SWYM.curToken && SWYM.curToken.text === newOp.behaviour.takeCloseBracket )
				{
					// bracket matched successfully!
					newOp.endSourcePos = SWYM.curToken.pos;
					SWYM.NextToken(); //chomp the close bracket

					if( SWYM.curToken && SWYM.curToken.text === "->" && SWYM.PeekNextToken() && SWYM.PeekNextToken().text === "{" )
					{
						// it's a ['foo']->{...} style block!

						SWYM.NextToken(); // chomp the ->

						// pack the ['foo'] into the { token
						SWYM.curToken.argName = SWYM.ParseTreeNode(undefined, curOp, rhs);
						curOp = undefined;
					}
					else
					{
						curLhs = SWYM.ParseTreeNode(curLhs, curOp, rhs);
						curOp = undefined;
					}					
				}
				else if( SWYM.curToken )
				{
					SWYM.LogError(curOp.pos, "Bracket "+newOp.text+" was not closed correctly. Expected "+newOp.behaviour.takeCloseBracket+", got '"+SWYM.curToken.text+"'");
				}
				else
				{
					SWYM.LogError(curOp.pos, "Bracket "+newOp.text+" was not closed.");
				}
			}
			else if (newOp.text === "else" )
			{
				if( SWYM.curToken.type !== "op" || (SWYM.curToken.text !== "{" && SWYM.curToken.text !== "(" && SWYM.curToken.text !== "=" && SWYM.curToken.text !== ":" ) )
				{
					// 'else' consumes either a {} pair, or the entire next sequence until a semicolon is reached.
					var rhs = SWYM.ParseLevel(2);
					curLhs = SWYM.ParseTreeNode(curLhs, curOp, rhs);
					curOp = undefined;
				}
			}
			else
			{
				var curOpCanHaveRhs = curLhs? curOp.behaviour.infix: curOp.behaviour.prefix;
				if ( !curOpCanHaveRhs )
				{
					// this op is finished, might as well resolve it now
					curLhs = SWYM.ParseTreeNode(curLhs, curOp, undefined);
					curOp = undefined;
				}
			}

			return undefined;
		}
	}
	
	var HandleAddLeaf = function()
	{
		if ( !curLhs && !curOp )
		{
			// haven't defined anything yet, start with the lhs
			curLhs = SWYM.curToken;
			SWYM.NextToken();
		}
        else if ( !curOp )
        {
			if( SWYM.curToken.followsBreak )
			{
				// no operator provided (or not one that could take a right-hand side), so insert a semicolon here.
				var result = HandleAddOp( SWYM.NewToken("op", SWYM.curToken.sourcePos, "(blank_line)"), true );
				if ( result ) { return result; }

				// then try adding this leaf again
				result = HandleAddLeaf();
				if ( result ) { return result; }
			}
			else if( SWYM.curToken.type === "name" && (SWYM.curToken.text[0] === "(" || SWYM.curToken.text[0] === "{" || SWYM.curToken.text[0] === "[") )
			{
				// Slightly weird special case... it's a literal whose name contains brackets.
				// insert parens around it. (this allows it to be a function call argument.)
				var openParen = SWYM.NewToken("op", SWYM.curToken.sourcePos, "(");
				SWYM.tokenlist.splice(SWYM.tokenIdx, 0, openParen);
				SWYM.tokenlist.splice(SWYM.tokenIdx+2, 0, SWYM.NewToken("op", SWYM.curToken.sourcePos, ")"));
				SWYM.curToken = SWYM.tokenlist[SWYM.tokenIdx];

				// ...and proceed.
				result = HandleAddOp(openParen);
				if ( result ) { return result; }
			}
			else
			{
				SWYM.LogError(SWYM.sourcePos, "Expected: line break or ; before '"+SWYM.curToken.text+"'");
			}
		}
		else
		{
			// we have an operator (and maybe an lhs). Recursively get the rhs, then apply the operator to it.
			if( curOp.behaviour.prefixPrecedence !== undefined && curLhs === undefined )
				curLhs = SWYM.ParseTreeNode(curLhs, curOp, SWYM.ParseLevel(curOp.behaviour.prefixPrecedence));
			else if( curOp.behaviour.rightAssociative )
				curLhs = SWYM.ParseTreeNode(curLhs, curOp, SWYM.ParseLevel(curOp.behaviour.precedence));
			else
				curLhs = SWYM.ParseTreeNode(curLhs, curOp, SWYM.ParseLevel(curOp.behaviour.precedence+1));
			curOp = undefined;
		}
	}


    // the actual body of SWYM.ParseLevel
	do
	{
		if ( !SWYM.curToken || (SWYM.curToken.behaviour && SWYM.curToken.behaviour.isCloseBracket) )
		{
			// end of file, or close bracket (which is treated much the same)
			return SWYM.ParseTreeNode(curLhs, curOp, undefined);
		}
		// handle the special "etc" keyword
		else if ( SWYM.curToken.type === "name" && SWYM.curToken.text === "etc" )
		{
			// etc always follows an operator.
			if( !curOp )
			{
				if ( curLhs && SWYM.curToken.followsBreak )
				{
					// etc requires an operator; if it follows a line break, that operator is the implicit line break separator.
					var result = HandleAddOp( SWYM.NewToken("op", SWYM.curToken.sourcePos, "(blank_line)"), true );
					if ( result )
					{
						return result.value;
					}
				}
				else
				{
					SWYM.LogError(SWYM.curToken.pos, "Expected an operator before 'etc'.");
					return undefined;
				}
			}

			var etcText = "etc";

			// etc usually consumes the text of the following operator, if there is one - to make the etc..< and etc** keywords, for example.
			SWYM.NextToken();
			if( SWYM.curToken && !SWYM.curToken.followsBreak && SWYM.curToken.type === "op" &&
				!SWYM.curToken.behaviour.isCloseBracket &&
				(SWYM.curToken.behaviour.precedence >= 50 || SWYM.curToken.text === curOp.text) )
			{
				etcText += SWYM.curToken.text;
				SWYM.NextToken();
			}
			else if( SWYM.curToken && SWYM.curToken.followsBreak && curOp && curOp.text === "(blank_line)" )
			{
				etcText += ";";
			}
			
			if( curOp )
				curOp.etc = etcText;
			else
				openBracketOp.etc = etcText;
		}
		else if ( SWYM.curToken.type === "decl" && SWYM.PeekNextToken() && SWYM.PeekNextToken().text === "->" &&
			SWYM.PeekNextToken(2) && SWYM.PeekNextToken(2).text === "{" )
		{
			// it's a 'foo'->{...} block expression
			var declToken = SWYM.curToken;
			SWYM.NextToken();
			SWYM.NextToken();
			// now curToken is the open brace
			SWYM.curToken.argName = declToken;
		}
		else if ( SWYM.curToken.behaviour )
		{
			// adding an operator
			var result = HandleAddOp( SWYM.curToken );
			if ( result )
			{
				return result.value;
			}
		}
		else
		{
			// adding a leaf
			var result = HandleAddLeaf( );
			if ( result )
			{
				return result.value;
			}
		}
	}
	while (SWYM.errors === "");
}

//=============================================================

SWYM.ParseTreeNode = function(lhs, op, rhs)
{
	if( op && !op.etc )
	{
		if( lhs && rhs && !op.behaviour.infix )
		{
			SWYM.LogError(op, "Operator "+op.text+" cannot be used infix style");
			return undefined;
		}
		else if( !lhs && rhs && !op.behaviour.prefix )
		{
			SWYM.LogError(op, "Operator "+op.text+" cannot be used prefix style");
			return undefined;
		}
		else if( lhs && !rhs && !op.behaviour.postfix )
		{
			SWYM.LogError(op, "Operator "+op.text+" cannot be used postfix style");
			return undefined;
		}
		else if( !lhs && !rhs && !op.behaviour.standalone )
		{
			SWYM.LogError(op, "Operator "+op.text+" cannot be used standalone style");
			return undefined;
		}
	}

	if( op && op.behaviour.customParseTreeNode )
	{
		return op.behaviour.customParseTreeNode(lhs, op, rhs);
	}
	else
	{
		return SWYM.NonCustomParseTreeNode(lhs, op, rhs)
	}
}

SWYM.NonCustomParseTreeNode = function(lhs, op, rhs)
{
    if ( lhs && !op && !rhs )
    {
        return lhs;
    }
    else if ( !lhs && !op && rhs )
    {
        return rhs;
    }
    else if ( !lhs && !op && !rhs )
    {
        return undefined;
    }
    else
    {
        var children;
        if( op.behaviour.takeBrackets )
        {
            children = lhs;
            if( rhs ) children.push(rhs);
        }
        else if ( rhs )
        {
            children = [lhs,rhs];
        }
        else if ( lhs )
        {
            children = [lhs];
        }
        else
        {
            children = [];
        }

        return {
            children:children,
            op:op,
            toString:function(){ return "(" + (this.children[0]?this.children[0]+" ":"") + (this.op.behaviour.debugText? this.op.behaviour.debugText: this.op.text) + (this.children[1]?" "+this.children[1]:"") + ")"; },
            type:"node"
        };
    }
}

SWYM.FunctionesqueParseTreeNode = function(name)
{
	return function(lhs, op, rhs)
	{
		if( !lhs )
			lhs = SWYM.NewToken("name", op.pos, "__default"); // ".foo" means "__default.foo".

		op.behaviour = SWYM.operators[name];

		return SWYM.ParseTreeNode(lhs, op, rhs);
	}
}

SWYM.OverloadableParseTreeNode = function(name)
{
	return function(lhs, op, rhs)
	{
		if( lhs !== undefined && (rhs !== undefined || op.etc !== undefined))
		{
			return {type:"fnnode", body:undefined, isDecl:false,
				name:name,
				etc:op.etc,
				children:[lhs, rhs],
				argNames:["this", "__"]
			};
		}
		else if( lhs !== undefined )
		{
			return {type:"fnnode", body:undefined, isDecl:false,
				name:name,
				etc:op.etc,
				children:[lhs],
				argNames:["this"]
			};
		}
		else if( rhs !== undefined )
		{
			return {type:"fnnode", body:undefined, isDecl:false,
				name:name,
				etc:op.etc,
				children:[rhs],
				argNames:["__"]
			};
		}
		else
		{
			return {type:"fnnode", body:undefined, isDecl:false,
				name:name,
				etc:op.etc,
				children:[],
				argNames:[]
			};
		}
	}
}

SWYM.IsTableNode = function(paramnode)
{
	// etc-based table?
	if( paramnode && paramnode.type === "etc" && paramnode.body && paramnode.body.op )
	{
		var etcOpText = paramnode.body.op.text;
		if( etcOpText === "," || etcOpText === ";" || etcOpText === "(blank_line)")
		{
			var child = paramnode.body.children[1];
			if( child && child.op && (child.op.text === ":" || child.op.text === "->") )
			{
				return true;
			}
		}
	}

	while( paramnode && paramnode.children && paramnode.op &&
			(paramnode.op.text === "," || paramnode.op.text === ";" || paramnode.op.text === "(blank_line)") )
	{
		if( paramnode.children[0] )
		{
			paramnode = paramnode.children[0];
		}
		else
		{
			paramnode = paramnode.children[1];
		}
	}
	
	return ( paramnode && paramnode.op && (paramnode.op.text === ":" || paramnode.op.text === "->") );
}

SWYM.ReadParamBlock = function(paramnode, fnnode)
{
	if( paramnode === undefined )
	{
		// an empty param block 
	}
	else if( paramnode.op &&
		(paramnode.op.text === "," || paramnode.op.text === ";" || paramnode.op.text === "(blank_line)") )
	{
		SWYM.ReadParamBlock(paramnode.children[0], fnnode);
		SWYM.ReadParamBlock(paramnode.children[1], fnnode);
	}
	else if( paramnode.op && paramnode.op.text === "=" &&
				paramnode.children[0] && paramnode.children[0].type === "argname" )
	{
		// passing a named parameter
		fnnode.argNames.push( paramnode.children[0].value );
		fnnode.children.push( paramnode.children[1] );
		paramnode.children[1].explicitNameRequired = true;
	}
	else if( paramnode.op && paramnode.op.text === "=" && paramnode.children[0] &&
		paramnode.children[0].type === "decl" )
	{
		// declaring a parameter with a default value
		fnnode.argNames.push( paramnode.children[0].value );
		fnnode.children.push( paramnode );
		paramnode.explicitNameRequired = paramnode.children[0].explicitNameRequired;
	}
	else if( paramnode.type === "decl" )
	{
		// declaring a parameter without a default value
		fnnode.argNames.push( paramnode.value );
		fnnode.children.push( paramnode );
	}
	else if ( paramnode.type === "argname" )
	{
		// passing a boolean flag 'true'
		fnnode.argNames.push( paramnode.value );
		fnnode.children.push( SWYM.NewToken("name", paramnode.pos, "true") );
	}
	else
	{
		// passing an anonymous parameter
		fnnode.argNames.push( "__" );
		fnnode.children.push( paramnode );
	}
}

SWYM.CombineFnNodes = function(lhs, rhs)
{
	if( !lhs )
	{
		SWYM.LogError(0, "Error: expected function name");
		return undefined;
	}
	
	if( lhs.etc !== undefined )
	{
		SWYM.LogError(lhs.pos, "Invalid etc expression");
	}
	else if( rhs.etc !== undefined )
	{
		SWYM.LogError(lhs.pos, "Invalid etc expression");
	}
	
	if( rhs.type === "name" || rhs.type === "decl" )
	{
		if( lhs.type === "name" || lhs.type === "decl" )
		{
			SWYM.LogError(0, "Error: too many function names!?");
			return undefined;
		}
		return SWYM.CombineFnNodes(rhs, lhs);
	}
	
	if( rhs.name !== undefined && ( lhs.type === "name" || lhs.type === "decl" || lhs.name !== undefined ))
	{
		SWYM.LogError(lhs.pos, "Fsckup: CombineFnNodes - combining too many names! rhs already has name "+rhs.name+"!?!");
		return undefined;
	}
	
	if( lhs.type === "name" )
	{
		rhs.pos = lhs.pos;
		
		if( lhs.numToken )
		{
			// pass numbers via the implicit # parameter
			rhs.children.push(lhs.numToken);
			rhs.argNames.push("#");
			rhs.name = "#"+lhs.numSuffix;
		}
		else
		{
			rhs.name = lhs.text;
		}
			
		return rhs;
	}
	else if( lhs.type === "decl" ) 
	{
		rhs.name = lhs.value;
		rhs.isDecl = true;
		rhs.pos = lhs.pos;

		// declare the implicit # parameter (for numeric functions like .1st)
		if( lhs.value[0] === "#" )
		{
			rhs.children.push(SWYM.NewToken("name", lhs.pos, "Number"));
			rhs.argNames.push("#");
		}

		return rhs;
	}
	else if ( lhs.type === "fnnode" )
	{
		if( rhs.type !== "fnnode" && rhs.type !== "name" )
		{
			SWYM.LogError(lhs.pos, "Error: expected a function name, got "+rhs.text);
			return lhs;
		}
		
		var baseNode = lhs;
		if( baseNode.addArgsTo !== undefined )
			baseNode = baseNode.addArgsTo;
				
		var newChildren = [];
		SWYM.pushEach(baseNode.children, newChildren);
		SWYM.pushEach(rhs.children, newChildren);

		var newArgNames = [];
		SWYM.pushEach(baseNode.argNames, newArgNames);
		SWYM.pushEach(rhs.argNames, newArgNames);

		var newBody = lhs.body? lhs.body: rhs.body;
		if( lhs.body && rhs.body )
		{
			SWYM.LogError(lhs.pos, "Error: too many function bodies!");
		}

		var result = ( rhs.name !== undefined )? rhs: lhs;
		result.body = newBody;

		var addArgsTo = (result.addArgsTo !== undefined)? result.addArgsTo: result;		
		addArgsTo.children = newChildren;
		addArgsTo.argNames = newArgNames;
		
		return result;
	}
	else if( lhs.type === "argname" )
	{
		SWYM.LogError(lhs.pos, "Work in progress");
		return rhs;
	}
	else
	{
		SWYM.LogError(lhs.pos, "Error: expected a function expression, got "+lhs);
		return rhs;
	}
}

SWYM.AutoLhsParseTreeNode = function(lhs, op, rhs)
{
	if( !lhs )
		lhs = SWYM.NewToken("name", op.pos, "__default"); // ".foo" means "__default.foo".
	return SWYM.NonCustomParseTreeNode(lhs, op, rhs);
}

SWYM.AutoLhsOverloadableParseTreeNode = function(name)
{
	var convertor = SWYM.OverloadableParseTreeNode(name);
	return function(lhs, op, rhs)
	{
		if( !lhs )
			lhs = SWYM.NewToken("name", op.pos, "__default"); // ".foo" means "__default.foo".
		return convertor(lhs, op, rhs);
	}
}

SWYM.BuildDotNode = function(lhs, op, rhs, wrapper)
{
	if( !lhs )
		lhs = SWYM.NewToken("name", op.pos, "__default"); // ".foo" means "__default.foo".

	if( op.etc !== undefined )
	{
		if( lhs.type !== "fnnode" || lhs.name === undefined )
		{
			SWYM.LogError(op.pos, "Expected a function call before .etc");
			return op;
		}
		else
		{
			return {type:"fnnode", etc:op.etc, arbitraryRecursion:true, name:lhs.name, children:[lhs, rhs], argNames:["this"]};
		}
	}
	
	if( !rhs && wrapper !== undefined )
	{
		// foo.! is equivalent to !foo
		op.behaviour = wrapper;
		return SWYM.NonCustomParseTreeNode(undefined, op, lhs);
	}

	var result = {type:"fnnode", body:undefined, isDecl:undefined, name:undefined, children:[lhs], argNames:["this"]};

	// foo.{<block>} is interpreted as running the 'do' function.
	if( rhs && rhs.op && (rhs.op.text === "{" || rhs.op.text === "[" || rhs.op.text === "(" || rhs.op.text === "~") )
	{
		rhs = {type:"fnnode", body:undefined, pos:op.pos, isDecl:false, name:"do", children:[rhs], argNames:["__"]};
	}

	// order matters! Put the rhs arguments into the list first, they're the ones that can be matched positionally.
	result = SWYM.CombineFnNodes(result, rhs);
	
	if( !wrapper )
	{
		return result;
	}
	else
	{
		op.behaviour = wrapper;
		return SWYM.NonCustomParseTreeNode(undefined, op, result);
	}
}

SWYM.BuildCompoundAssignmentNode = function(operatorName)
{
	return function(lhs, op, rhs)
	{
		if ( lhs && lhs.type === "fnnode" && !lhs.isDecl )
		{
			// pass a __mutator={it op rhs} argument to this function
			var compoundOp = SWYM.NewToken("op", op.pos, operatorName);
			var compoundNode = compoundOp.behaviour.customParseTreeNode( SWYM.NewToken("name", op.pos, "it"), compoundOp, rhs );
			var braceOp = SWYM.NewToken("op", op.pos, "{");
			var braceNode = braceOp.behaviour.customParseTreeNode(undefined, braceOp, compoundNode);
			var result = {type:"fnnode", body:undefined, isDecl:undefined, name:undefined, children:[braceNode], argNames:["__mutator"]};
			
			return SWYM.CombineFnNodes(lhs, result);
		}
		else
		{
			return SWYM.NonCustomParseTreeNode(lhs, op, rhs);
		}
	}
}

SWYM.onLoad("swymParser.js");