SWYM = {};
SWYM.loaded = {};
SWYM.onLoad = function(name)
{
	SWYM.loaded[name] = true;
	if( SWYM.onLoadCallback !== undefined )
	{
		if( SWYM.areAllScriptsLoaded() )
		{
			SWYM.onLoadCallback();
		}
	}
};
SWYM.scriptsToLoad = ["swym.js", "swymTokenize.js", "swymParser.js", "swymEtc.js", "swymRuntime.js", "swymCompile.js", "swymTypeCheck.js", "swymStdlyb.js"];

function loadjs(filename)
{
  var scriptTag=document.createElement('script');
  scriptTag.setAttribute("type","text/javascript");
  scriptTag.setAttribute("src", filename);
  document.getElementsByTagName("head")[0].appendChild(scriptTag);
}

for( var Idx = 0; Idx < SWYM.scriptsToLoad.length; ++Idx )
{
	loadjs(SWYM.scriptsToLoad[Idx]);
}

SWYM.areAllScriptsLoaded = function()
{
	for( var Idx = 0; Idx < SWYM.scriptsToLoad.length; ++Idx )
	{
		if( !SWYM.loaded[SWYM.scriptsToLoad[Idx]] )
		{
			return false;
		}
	}
	return true;
}

SWYM.setCallbackOnLoad = function(callback)
{
	SWYM.onLoadCallback = callback;
	if( SWYM.areAllScriptsLoaded() )
	{
		SWYM.onLoadCallback();
	}
}