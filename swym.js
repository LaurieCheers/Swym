SWYM = {};

SWYM.LogError = function(textpos, message)
{
	SWYM.errors += "Line "+SWYM.LineForTextPos(SWYM.source, textpos)+":"+SWYM.PosInLineForTextPos(SWYM.source, textpos)+" - "+message+"\n";
	SWYM.halt = true;
}

SWYM.errors = "";
SWYM.safeMode = 0;

// Thanks, Douglas.
function object(o)
{
  function Construct() {}
  Construct.prototype = o;
  return new Construct();
}

SWYM.CountLines = function(str)
{
  var result = 1;
  for ( var i = 0; str[i] !== undefined; i++ )
  {
    if (str[i] === '\n' && str[i+1] !== undefined)
      result++;
  }
  return result;
}

SWYM.TextPosForLine = function(text, linenum)
{
  var curlinenum = 1;
  var linestart = 0;
  for( var i = 0; i < text.length; i++ )
  {
    if ( curlinenum >= linenum )
      return i;
    if ( text[i] === '\n' )
      curlinenum++;
  }
  return i;
}

SWYM.LineForTextPos = function(text, textpos)
{
  if( textpos === undefined )
	return '?';

  var result = 1;
  for ( var i = 0; i < textpos; i++ )
  {
    if (text[i] === '\n')
      result++;
  }
  return result;
}

SWYM.PosInLineForTextPos = function(text, textpos)
{
  if( textpos === undefined )
	return '?';

  var result = 1;
  for ( var i = 1; i <= textpos; i++ )
  {
    if (text[textpos-i] === '\n')
      return i;
  }
  return i;
}

SWYM.ReportErrors = function(ErrorType, OutputSoFar)
{
  if ( SWYM.errors !== "" )
  {
    var numErrors = SWYM.CountLines(SWYM.errors);
    return "-- "+ErrorType+(numErrors>1? ("s ("+numErrors+")"): "")+" --\n" + SWYM.errors + (OutputSoFar?("\n\nOutput so far:\n"+OutputSoFar):"");
  }
}

SWYM.EvalStdlyb = function(source)
{
	SWYM.errors = "";
	SWYM.safeMode = 0;
	SWYM.halt = false;
	
	var tokenlist = SWYM.Tokenize(source);
	var parsetree = SWYM.Parse(tokenlist);

	SWYM.DefaultGlobalRScope = {};
	for( var name in SWYM.DefaultGlobalCScope )
	{
		if( SWYM.DefaultGlobalCScope[name].baked !== undefined )
			SWYM.DefaultGlobalRScope[name] = SWYM.DefaultGlobalCScope[name].baked;
	}

	var executable = [];
	var resultType = SWYM.CompileNode(parsetree, SWYM.DefaultGlobalCScope, executable);

	var result = SWYM.ReportErrors("Stdlyb Error");
	if ( result ) alert(result);
	
	SWYM.ExecWithScope("stdlyb", executable, SWYM.DefaultGlobalRScope);

	result = SWYM.ReportErrors("Stdlyb Exec Error");
	if ( result ) alert(result);
}

SWYM.Eval = function(readsource, keepScope)
{
	var result = "<no output>";
	SWYM.DisplayOutput = function(a){ result = a; SWYM.DisplayOutput = function(b){ result += b; }; };
	SWYM.DisplayError = function(e){ result = e; };
	SWYM.FullEval(readsource, keepScope);
	
	return result;
}

SWYM.FullEval = function(readsource, keepScope)
{
	SWYM.errors = "";
	SWYM.halt = false;
	SWYM.doFinalOutput = true;
	
	var tokenlist = SWYM.Tokenize(readsource);
	var result;
	
	result = SWYM.ReportErrors("Reading Error");
	if ( result ) return SWYM.DisplayError(result);
	
	//temp
//	return tokenlist;
//	alert("tokens: "+tokenlist);
	
	var parsetree = SWYM.Parse(tokenlist);

	result = SWYM.ReportErrors("Parsing Error");
	if ( result ) return SWYM.DisplayError(result);
	
//	return parsetree;
//	alert("parsed: "+parsetree);

	var executable = SWYM.Compile(parsetree, keepScope);
	
	result = SWYM.ReportErrors("Compiling Error");
	if ( result ) return SWYM.DisplayError(result);

	//return executable;

	SWYM.Exec(executable, keepScope);

	result = SWYM.ReportErrors("Runtime Error");
	if ( result ) return SWYM.DisplayError(result);
	
/*	var parsetree = Compile(tokenlist);
	
	result = ReportErrors("Compiling Error");
	if ( result ) return result;
	
	var bakedlist = {};
	parsetree.bakeToList(bakedlist);
//	var bakedtree = parsetree.bake();
	
	result = ReportErrors("Baking Error");
	if ( result ) return result;
	
	PrintedOutput = "";
	var output = RunSequence(globalscope, bakedlist.next);
	
	//var output = bakedtree.eval();
	if ( PrintedOutput !== "" )
	{
		output = PrintedOutput;// + "\n\n -- result: " + output;
	}
	else
	{
		output = "<no output>";
	}
	
	result = ReportErrors("Runtime Error", output);
	if ( result ) return result;
	*/
//	return output;
}