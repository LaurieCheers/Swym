// entry point
SWYM.Tokenize = function(readsource)
{
	SWYM.source = readsource;
	SWYM.sourcePos = 0;
	SWYM.c = SWYM.source[SWYM.sourcePos];
	
	var result = [];
	do
	{
		var done = SWYM.GenerateNextToken(result);
	}
	while( !done );
	return result;
}

//=============================================================

SWYM.NextChar = function(step)
{
	SWYM.sourcePos+=(step?step:1);
	SWYM.c = SWYM.source[SWYM.sourcePos];
}

SWYM.SetNextChar = function(pos)
{
	SWYM.sourcePos=pos;
	SWYM.c = SWYM.source[SWYM.sourcePos];
}

//=============================================================

SWYM.PeekNext = function(offset) { return SWYM.source[SWYM.sourcePos+(offset?offset:1)]; }
SWYM.PeekPrev = function() { return SWYM.source[SWYM.sourcePos-1]; }

SWYM.IsLetter = function(c) { if (!c) c = SWYM.c; return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'); }
SWYM.IsDigit = function(c) { if (!c) c = SWYM.c; return (c >= '0' && c <= '9'); }
SWYM.IsLetterOrDigit = function(c) { return SWYM.IsLetter(c) || SWYM.IsDigit(c); }

SWYM.whitespaceString = " \xA0\n\t\r"; //A0 = non-breaking space
SWYM.IsWhitespace = function(c) { return SWYM.whitespaceString.indexOf(c?c:SWYM.c) >= 0; }

SWYM.symbolString = ".:!$%^|&*-=+;@~,/?<>(){}[]";
SWYM.IsSymbol = function(c) { return SWYM.symbolString.indexOf(c?c:SWYM.c) >= 0; }

SWYM.extendedSymbolString = "_."; // symbols that can appear in the body of an operator, but not at the start.
SWYM.IsExtendedSymbol = function(c)
{
	return SWYM.IsSymbol(c) || SWYM.extendedSymbolString.indexOf(c?c:SWYM.c) >= 0;
}

//=============================================================

SWYM.FindEndOfWord = function()
{
	if ( SWYM.IsLetter() || SWYM.c === '_' )
	{
		do { SWYM.NextChar(); }
		while( SWYM.IsLetter() || SWYM.IsDigit() || SWYM.c === '_' );
	}
}

//=============================================================

SWYM.SkipWhitespace = function(tokenlist)
{
	var result = false;
	while(true)
	{
		var newlinesSeen = 0;
		while( SWYM.IsWhitespace() )
		{
			if( SWYM.c === '\n' )
			{
				newlinesSeen++;
				SWYM.followsBreak = true;
			}
			SWYM.NextChar();
		}

		if( newlinesSeen >= 2 )
		{
			// two newlines in a row? Insert a 'blank line' operator.
			tokenlist.push(SWYM.NewToken("op", SWYM.sourcePos, "(blank_line)"));
		}
		
		if ( SWYM.c === '/' )
		{
			var c2 = SWYM.PeekNext();
			if ( c2 === '/' )
			{
				// line comment
				SWYM.NextChar();
				do { SWYM.NextChar(); }
				while( SWYM.c !== '\n' && SWYM.c !== undefined );

				SWYM.followsBreak = true;
			}
			else if ( c2 === '*' )
			{
				var commentStartPos = SWYM.sourcePos;
				// block comment
				SWYM.NextChar();
				do
				{
					SWYM.NextChar();
					if ( SWYM.c === '*' && SWYM.PeekNext() === '/' )
					{
						SWYM.NextChar(2);
						break;
					}
					else if ( SWYM.c === undefined )
					{
						LogError(commentStartPos, "Block comment /* has no matching * /");
						break;
					}
				}
				while( true );

				SWYM.followsBreak = true;
			}
			else
			{
				return; // finished skipping whitespace
			}
		
			continue; // see if we can skip more whitespace
		}
		else
		{
			return; // finished skipping whitespace
		}
	}
}

//=============================================================

SWYM.GetSource = function(start, end)
{
	if (end != undefined)
		return SWYM.source.substring(start,end);
	else if (start != undefined)
		return SWYM.source.substring(start, SWYM.sourcePos);
	else
		return SWYM.source;
}

SWYM.TokenBuffer = [];

//=============================================================

// returns true to signal "end"
SWYM.GenerateNextToken = function(tokenlist, ignoreDecl)
{
	SWYM.followsBreak = false;
	
	SWYM.SkipWhitespace(tokenlist);

	if ( SWYM.c === '"' )
	{
		if ( SWYM.PeekNext() === '"' && SWYM.PeekNext(2) === '"' )
		{
			// looks like a """triple quoted""" string
			return SWYM.GenerateTripleQuotedString(tokenlist);
		}
		else
		{
			// it's a "quoted" string
			return SWYM.GenerateString(tokenlist);
		}			
	}
	else if (SWYM.c === "'" )
	{
		// it's a declaration
		return SWYM.GenerateDeclaration(tokenlist);
	}
	else if ( SWYM.IsSymbol() )
	{
		// read an operator. Operators start with a symbol and continue with symbols, letters, and/or '_'s.
		// e.g:  +_  ==any  !is
		var opStartPos = SWYM.sourcePos;
		var peekoffs = 0;
		do
		{
			peekoffs++;
			var opchar = SWYM.PeekNext(peekoffs);
		}
		while( opchar && (SWYM.IsExtendedSymbol(opchar) || SWYM.IsLetter(opchar)) );

		// truncate the text until it matches an operator we know of
		var allsymbols = SWYM.GetSource(opStartPos, SWYM.sourcePos+peekoffs);
		do
		{
			var possibleOpText = SWYM.GetSource(opStartPos, SWYM.sourcePos+peekoffs);
            var op = SWYM.operators[possibleOpText];
		}
		while(!op && --peekoffs > 0);

		if( possibleOpText === "{-" )
		{
			SWYM.LogError(opStartPos, "Ambiguous minus sign. To negate a number, add a space: '{ -'. To subtract, add an explicit 'it':  '{it-'.");
		}

		if ( op )
		{
			// matched an operator
			var newToken = SWYM.NewToken("op", opStartPos, possibleOpText);
			
			/*if( newToken.text === "->" )
			{
				var prevToken = tokenlist.pop();
				if( prevToken.type === "decl" )
				{
					newToken.value = prevToken.value;
				}
				else if ( prevToken.text === "]" )
				{
					// list deconstruction arg
					tokenlist.push(prevToken);
				}
				else
					SWYM.LogError(newToken.sourcePos, "-> operator must appear after a declaration");
			}
			else if ( newToken.text === "{" )
			{
				var prevToken = tokenlist[tokenlist.length-1];
				if( prevToken && prevToken.text === "->" )
				{
					tokenlist.pop();
					newToken.argName = prevToken.value;
				}
			}*/

			if( SWYM.followsBreak )
				newToken.followsBreak = true;

			tokenlist.push(newToken);

			SWYM.NextChar(peekoffs); // chomp the appropriate number of characters
			
			return;
		}
		else
		{
			SWYM.LogError(opStartPos, "Don't understand operator \'"+allsymbols[0]+"\'");
		}
	}
	else if ( SWYM.IsLetter() || SWYM.IsDigit() || SWYM.c === '#' || SWYM.c === '_' )
	{
		// it's a number literal, or an identifier (possibly a numeric function name)
		return SWYM.GenerateIdentifier(tokenlist, ignoreDecl);
	}
	else if ( SWYM.c !== undefined )
	{
		SWYM.LogError(SWYM.sourcePos, "Unrecognized character \'"+SWYM.c+"\'");
		// keep trying to parse the rest of the file?
		SWYM.NextChar();
		return SWYM.GenerateNextToken(tokenlist, ignoreDecl);
	}

	// end of file
//	alert("reached eof, c is "+SWYM.c);
	return true;
}

//=============================================================

SWYM.GenerateNumberLiteral = function(tokenlist, nofloatingpoint)
{
	var numSoFar = 0;
	var numStartPos = SWYM.sourcePos;
	do
	{
		numSoFar = numSoFar*10 + (SWYM.c - '0');
		SWYM.NextChar();
	}
	while( SWYM.IsDigit() );

    if ( SWYM.c === '.' && SWYM.IsDigit(SWYM.PeekNext()) && !nofloatingpoint )
    {
        // floating point number
        var numerator = 0;
        var denominator = 1;
        SWYM.NextChar();
        
        do
        {
            numerator = numerator*10 + (SWYM.c - '0');
            denominator *= 10;
            SWYM.NextChar();
        }
        while( SWYM.IsDigit() );
        
        numSoFar += numerator/denominator;
    }
	
	tokenlist.push(SWYM.NewToken("literal", numStartPos, SWYM.GetSource(numStartPos), numSoFar));
	return;
}

//=============================================================

SWYM.GenerateIdentifier = function(tokenlist, ignoreDecl)
{
	// read an identifier or number literal.
	var chunkStartPos = SWYM.sourcePos;
	var allDigits = true;
	
	var numberToken = [];
	if( SWYM.IsDigit() )
	{
		// this identifier starts with a number, so we'll begin by parsing the number
		SWYM.GenerateNumberLiteral(numberToken);
	}

	var textStartPos = SWYM.sourcePos;
	
	// an identifier is any number of consecutive letters, digits, hashes and/or underscores.
	while( SWYM.IsLetter() || SWYM.IsDigit() || SWYM.c === '_' || SWYM.c === '#' )
	{
		SWYM.NextChar();
	}
    var chunkEndPos = SWYM.sourcePos;
    	
    var text = SWYM.GetSource(textStartPos, chunkEndPos);

	if ( numberToken.length > 0 )
	{
		if( text === "" )
		{
			// ok, it was just a number
			SWYM.pushEach(numberToken, tokenlist);
		}
		else
		{
			// it's passing the number as argument # of a function call!
			var functionName = "#"+text;
			
			// FIXME: very weird to do this inside the tokenizer, but for now
			// it's the easiest way to make etc expressions accept 1st and 2nd as
			// calls to the same function...
			// Probably not acceptable as a permanent solution, what if we wanted to
			// write 7stone or something
			if( /^#st|#nd|#rd/.test(functionName) )
			{
				functionName = "#th"+functionName.slice(3);
			}
			
			tokenlist.push(
				{type:"fnnode", pos:chunkStartPos, body:undefined, isDecl:false, name:functionName, children:numberToken, argNames:["#"]}
			);
		}
	}
	else if( SWYM.operators[text] )
    {
		// handle keyword operators
        tokenlist.push(SWYM.NewToken("op", chunkStartPos, text));
    }
	else
	{
		// just a name
		tokenlist.push(SWYM.NewToken("name", chunkStartPos, text));
	}
}

//=============================================================

SWYM.GenerateDeclaration = function(tokenlist)
{
	// it's a quoted declaration
	SWYM.NextChar(); // chomp the open quote
	var tokenStartPos = SWYM.sourcePos;
	
	// an identifier is any sequence of symbols, excluding quotes and whitespace.
	while( SWYM.c !== "'" && SWYM.c !== undefined && !SWYM.IsWhitespace() )
    {
		SWYM.NextChar();
	}
	var chunkEndPos = SWYM.sourcePos;
	var declText = SWYM.GetSource(tokenStartPos, chunkEndPos);
	
	if( SWYM.c !== "'" )
	{
		if( declText === "" )
		{
			var prevToken = tokenlist[tokenlist.length-1];
			if( prevToken && prevToken.type === "name" )
				SWYM.LogError(prevToken.pos, "Missing open quote when declaring "+prevToken.text);
			else
				SWYM.LogError(tokenStartPos-1, "Unexpected quote symbol");
		}
		else
			SWYM.LogError(tokenStartPos, "Missing close quote when declaring "+declText);
		return true;
	}
	SWYM.NextChar();
	
	tokenlist.push(SWYM.NewToken("decl", tokenStartPos, "'"+declText+"'", declText));
}

//=============================================================

SWYM.GenerateTripleQuotedString = function(tokenlist)
{
	var stringOpenQuotesPos = SWYM.sourcePos;

	SWYM.NextChar(3);
	
	var stringStartPos = SWYM.sourcePos;

	while( true )
	{
		if ( SWYM.c === undefined )
		{
			SWYM.LogError(stringOpenQuotesPos, "\"\"\"Triple Quoted\"\"\" string was not terminated");
			return;
		}
		else if( SWYM.c === '"' && SWYM.PeekNext() === '"' && SWYM.PeekNext(2) === '"' )
		{
			// ignore one final newline, to allow the string to be laid out nicely.
			//if( SWYM.source[closePos-1] === "\n" )
			//{
			//	--closePos;
			//}
			var theString = SWYM.GetSource(stringStartPos, SWYM.sourcePos);
			tokenlist.push(SWYM.NewToken("literal", stringOpenQuotesPos, theString, theString));
			
			SWYM.NextChar(3);

			return;
		}
		else
		{
			SWYM.NextChar();
		}
	}
}

//=============================================================

SWYM.GenerateString = function(tokenlist)
{
	// quoted string
	var parsedString = "";
	var stringOpenQuotePos = SWYM.sourcePos;
	var stringStartPos = SWYM.sourcePos;
	var needsAdd = false;
	var firstSegment = true;
	SWYM.NextChar();
	
	if( SWYM.c === '"' )
	{
		//empty string
		tokenlist.push(SWYM.NewToken("literal", stringStartPos, "", ""));
		SWYM.NextChar();
		return;
	}

	while( SWYM.c !== '"' )
	{
		if ( SWYM.c === undefined )
		{
			SWYM.LogError(stringOpenQuotePos, "Unexpected end-of-file in string");
			return true;
		}
		else if ( SWYM.c === "\n" )
		{
			SWYM.LogError(stringOpenQuotePos, "Unexpected line-break in string. (For a multiline string, use \"\"\"triple quotes\"\"\".)");
			return true;
		}
		else if ( SWYM.c === "\\" )
		{
			// handle escaped characters
			SWYM.NextChar();
			switch( SWYM.c )
			{
				case "n":	parsedString = parsedString.concat("\n");	break;
				case "t":	parsedString = parsedString.concat("\t");	break;
				case "r":	parsedString = parsedString.concat("\r");	break;
				default:
					parsedString = parsedString.concat(SWYM.c);
					break;
			}
			SWYM.NextChar();
		}
		else if ( SWYM.c !== "$" )
		{
			// default case, just add the character
			parsedString = parsedString.concat(SWYM.c);
			SWYM.NextChar();
		}
		else if( SWYM.PeekNext() === "\"" || SWYM.IsDigit(SWYM.PeekNext()) )
		{
			// treat as a literal dollar sign
			parsedString = parsedString.concat("$");
			SWYM.NextChar();
		}
		else
		{
			// string interpolation using $ (pretty mode) or $$ (debug mode).
			// e.g. "hello $person.name, how are you?" or "hello $(expression), how are you?", or "Got here, x is $$x".
			if( SWYM.PeekNext() === "$" )
			{
				var prettify = false;
				SWYM.NextChar();
			}
			else
			{
				var prettify = true;
			}
			var interppos = SWYM.sourcePos;
			var done = false;

			if (needsAdd)
				tokenlist.push(SWYM.NewToken("op", interppos, "(str++)"));
			
			if ( parsedString.length > 0 || firstSegment)
			{
				tokenlist.push(SWYM.NewToken("literal", stringStartPos, parsedString, parsedString));
				tokenlist.push(SWYM.NewToken("op", interppos, "(str++)"));
			}
			SWYM.NextChar();
			
			// insert the appropriate stringize operator: $ or $$
			tokenlist.push(SWYM.NewToken("op", SWYM.sourcePos, "("));
			if( prettify )
			{
				tokenlist.push(SWYM.NewToken("op", SWYM.sourcePos, "$"));
			}
			else
			{
				tokenlist.push(SWYM.NewToken("op", SWYM.sourcePos, "$$"));
			}

			if ( SWYM.c === '(' || SWYM.c === '{' || SWYM.c === '[')
			{
				// read until the corresponding close bracket
				var bracketdepth = 1;
				var openbracket = SWYM.c;

				var openBracketToken = SWYM.NewToken("op", SWYM.sourcePos, openbracket);
				tokenlist.push(openBracketToken);
				
				var closebracket = openBracketToken? openBracketToken.behaviour.takeCloseBracket: undefined;
				
				SWYM.NextChar();

				while (!done)
				{
					done = SWYM.GenerateNextToken(tokenlist);
					var generated = tokenlist[tokenlist.length-1];
					
					if ( generated.type === "op" && generated.text === openbracket )
					{
							bracketdepth++;
					}
					else if ( generated.type === "op" && generated.text === closebracket)
					{
							bracketdepth--;
					}
						
					if ( bracketdepth == 0 )
						break;
				}
				
				if ( done )
				{
					SWYM.LogError(interppos, "Unexpected end of file during $"+openbracket+"..."+closebracket+" string interpolation");
					return true;
				}
			}
			else if (SWYM.IsLetter() || SWYM.c === '_' || SWYM.c === '.')
			{
                tokenlist.push(SWYM.NewToken("op", SWYM.sourcePos, "("));

				do
				{
					done = SWYM.GenerateNextToken(tokenlist, true);
				}
				while ( !done && (SWYM.IsLetterOrDigit() || SWYM.c === '_' || ( SWYM.c === '.' && SWYM.IsLetterOrDigit( SWYM.PeekNext() ))) );

                tokenlist.push(SWYM.NewToken("op", SWYM.sourcePos, ")"));
				
				if ( done )
				{
					SWYM.LogError(interppos, "Unexpected end of file during $foo.bar string interpolation");
					return true;
				}
			}
			else
			{
				SWYM.LogError(interppos, "Invalid string interpolation '$"+SWYM.c+"'. For a literal dollar sign, write '\\$'.");
				tokenlist.push(SWYM.NewToken("literal", SWYM.sourcePos, "", ""));
			}
			
			// close the bracket for the stringize operator
			tokenlist.push(SWYM.NewToken("op", SWYM.sourcePos, ")"));

			needsAdd = true;
			firstSegment = false;
			parsedString = "";
			stringStartPos = SWYM.sourcePos;
		}
	}

	if ( parsedString.length > 0 )
	{
		if ( needsAdd )
			tokenlist.push(SWYM.NewToken("op", stringStartPos, "(str++)"));

		tokenlist.push(SWYM.NewToken("literal", stringStartPos, parsedString, parsedString));
	}

	SWYM.NextChar();
}

SWYM.BaseTokens = (function()
{
	var result = {};
	
	function Add(t) { result[t] = {type:t, toString:function(){ return ""+this.type+'('+this.text+')';} }; };
	
	function AddBracket(type, symbol)
	{
		var x = object(result[type]);
		x.text = symbol;
		result[symbol] = x;
	}
	
	function QuotedToken(){ return ""+this.type+'"'+this.text+'"';}
	
	Add("name");
	Add("op");
	Add("rawdata");
	Add("decl");
	Add("literal");
	Add("etc");

	return result;
})();

SWYM.NewToken = function(type, pos, text, value)
{
	if ( SWYM.BaseTokens[type] )
	{
		var result = object(SWYM.BaseTokens[type]);
		result.pos = pos;
		result.source = SWYM.source;
		if ( text != undefined ) result.text= text;
		
		if ( type == "op" )
			result.behaviour = SWYM.operators[text];
		else
			result.behaviour = SWYM.operators[type];
		
		if ( value != undefined )
			result.value = value;
		
		if( SWYM.followsBreak )
			result.followsBreak = true;
			
		return result;
	}
	SWYM.LogError(pos, "Internal error: Invalid token type "+type);
}

SWYM.GetFunctionName = function(fromToken)
{
	if( fromToken.numToken )
	{
		if( /^(st|nd|rd)/.test(fromToken.numSuffix) )
			return ".#th"+fromToken.numSuffix.slice(2);
		else
			return ".#"+fromToken.numSuffix;
	}
	else
	{
		return "."+fromToken.text;
	}
}