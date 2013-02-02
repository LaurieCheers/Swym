
SWYM.Parse = function(tokenlist)
{
	SWYM.tokenlist = tokenlist;
	SWYM.tokenIdx = 0;
	SWYM.curToken = SWYM.tokenlist[0];
	
	var parsetree = SWYM.ParseLevel(0);
	
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

SWYM.PeekNextToken = function()
{
	return SWYM.tokenlist[SWYM.tokenIdx+1];
}

//=============================================================

SWYM.ParseLevel = function(minpriority, startingLhs)
{
	var curLhs = startingLhs;
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
		else if ( curLhs && !newOpCanHaveLhs )
		{
			if( newOp.followsBreak )
			{
				// have to auto-insert the blank_line operator.
				var result = HandleAddOp( SWYM.NewToken("op", SWYM.curToken.sourcePos, "(blank_line)"), true );
				if ( result )
				{
					return result;
				}
			}
			else
			{
				SWYM.LogError(newOp.pos, "Expected: line break or ; before operator '"+newOp.text+"'");
			}
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
				var autoLhs;

				// special case: if we see an operator requiring a lhs, immediately after a {, auto-insert "__default".
				if( newOp.text === "{" && SWYM.curToken && SWYM.curToken.behaviour && !SWYM.curToken.behaviour.prefix && !SWYM.curToken.behaviour.standalone && !SWYM.curToken.behaviour.isCloseBracket )
				{
					autoLhs = SWYM.NewToken("name", SWYM.curToken.sourcePos, "__default");
				}

				var rhs = SWYM.ParseLevel(0, autoLhs);

				if ( SWYM.curToken && SWYM.curToken.text === newOp.behaviour.takeCloseBracket )
				{
					// bracket matched successfully!
					newOp.endSourcePos = SWYM.curToken.pos;
					SWYM.NextToken(); //chomp the close bracket

					if( SWYM.curToken && SWYM.curToken.text === "->" )
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
				var newOpCanHaveRhs = curLhs? curOp.behaviour.infix: curOp.behaviour.prefix;
				if ( !newOpCanHaveRhs )
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
            // no operator provided (or not one that could take a right-hand side), so insert a semicolon here.
			if( SWYM.curToken.followsBreak )
			{
				var result = HandleAddOp( SWYM.NewToken("op", SWYM.curToken.sourcePos, "(blank_line)"), true );
				if ( result ) { return result; }

				// then try adding this leaf again
				result = HandleAddLeaf();
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
			if( curOp.behaviour.rightAssociative )
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
			if( !curOp )
			{
				SWYM.LogError(SWYM.curToken.pos, "Expected an operator before 'etc'.");
				return undefined;
			}

			var etcText = "etc";

			// etc usually consumes the text of the following operator, if there is one - to make the etc..< and etc** keywords, for example.
			SWYM.NextToken();
			if( SWYM.curToken && SWYM.curToken.type === "op" && !SWYM.curToken.behaviour.isCloseBracket && SWYM.curToken.behaviour.precedence >= 50 )
			{
				etcText += SWYM.curToken.text;
				SWYM.NextToken();
			}
			
			curOp.etc = etcText;
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
		else if ( SWYM.curToken.type === "decl" && SWYM.PeekNextToken() && SWYM.PeekNextToken().text === "->" )
		{
			// it's a 'foo'->{...} block expression
			var declToken = SWYM.curToken;
			SWYM.NextToken();
			SWYM.NextToken();
			if( !SWYM.curToken || SWYM.curToken.text !== "{" )
			{
				SWYM.LogError(declToken.sourcePos, "Illegal use of the -> operator - expected a following {...}, got "+SWYM.curToken);
			}
			else
			{
				SWYM.curToken.argName = declToken;
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

SWYM.OverloadableOperatorParseTreeNode = function(name)
{
	return function(lhs, op, rhs)
	{
		return {type:"fnnode", body:undefined, isDecl:false,
			name:name,
			etc:op.etc,
			children:[lhs, rhs],
			argNames:["this", "__"]
		};
	}
}

SWYM.IsTableNode = function(paramnode)
{
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
	
	return ( paramnode && paramnode.op && paramnode.op.text === ":" && paramnode.children[1].type !== "decl" );
}

SWYM.ReadParamBlock = function(paramnode, fnnode)
{
	if( paramnode && paramnode.op &&
		(paramnode.op.text === "," || paramnode.op.text === ";" || paramnode.op.text === "(blank_line)") )
	{
		SWYM.ReadParamBlock(paramnode.children[0], fnnode);
		SWYM.ReadParamBlock(paramnode.children[1], fnnode);
	}
	else if( paramnode && paramnode.op && paramnode.op.text === "=" && paramnode.children[0].type === "name" )
	{
		// passing a named parameter
		fnnode.argNames.push( paramnode.children[0].text );
		fnnode.children.push( paramnode.children[1] );
	}
	else if( paramnode && paramnode.op && paramnode.op.text === "=" &&  paramnode.children[0].type === "decl" )
	{
		// declaring a parameter with a default value
		fnnode.argNames.push( paramnode.children[0].value );
		fnnode.children.push( paramnode.children[1] );
	}
	else if( paramnode && paramnode.op && paramnode.op.text === ":" && paramnode.children[1].type === "decl" )
	{
		// declaring a parameter with a type
		fnnode.argNames.push( paramnode.children[1].value );
		fnnode.children.push( paramnode );
	}
	else if( paramnode && paramnode.type === "decl" )
	{
		// declaring a parameter without a type or default value
		fnnode.argNames.push( paramnode.value );
		fnnode.children.push( paramnode );
	}
	else if ( paramnode )
	{
		// passing an anonymous parameter
		fnnode.argNames.push( "__" );
		fnnode.children.push( paramnode );
	}
}

SWYM.CombineFnNodes = function(base, add)
{
	if( !base )
	{
		SWYM.LogError(0, "Error: expected function name");
	}
	else if( add.name )
	{
		SWYM.LogError(base.pos, "Fsckup: CombineFnNodes - add already has name "+add.name+"!?!");
	}
	else if( base.type === "name" )
	{
		add.pos = base.pos;
		
		if( base.numToken )
		{
			// pass numbers via the implicit # parameter
			add.children.push(base.numToken);
			add.argNames.push("#");
			add.name = "#"+base.numSuffix;
		}
		else
		{
			add.name = base.text;
		}
			
		return add;
	}
	else if( base.type === "decl" ) 
	{
		add.name = base.value;
		add.isDecl = true;
		add.pos = base.pos;

		// declare the implicit # parameter
		if( base.value[0] === "#" )
		{
			add.children.push(SWYM.NewToken("name", base.pos, "Number"));
			add.argNames.push("#");
		}

		return add;
	}
	else if ( base.type === "fnnode" )
	{
		SWYM.pushEach(add.children, base.children);
		SWYM.pushEach(add.argNames, base.argNames);
		
		if( add.body )
		{
			if( base.body )
				SWYM.LogError(0, "Error: too many function bodies!");
			else
				base.body = add.body;
		}
		return base;
	}
	else
	{
		SWYM.LogError(base.pos, "Error: expected a function expression, got "+base);
		return add;
	}
}

SWYM.BuildDotNode = function(lhs, op, rhs, wrapper)
{
	if( !lhs )
		lhs = SWYM.NewToken("name", op.pos, "__default"); // ".foo" means "__default.foo".

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
		rhs = {type:"fnnode", body:undefined, isDecl:false, name:"do", children:[rhs], argNames:["__"]};
	}

	// order matters! Put the rhs arguments into the list first, they're the ones that can be matched positionally.
	result = SWYM.CombineFnNodes(rhs, result);
	
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