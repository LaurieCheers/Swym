/**
 * SyntaxHighlighter
 * http://alexgorbatchev.com/SyntaxHighlighter
 *
 * SyntaxHighlighter is donationware. If you are using it, please donate.
 * http://alexgorbatchev.com/SyntaxHighlighter/donate.html
 *
 * @version
 * 3.0.83 (July 02 2010)
 * 
 * @copyright
 * Copyright (C) 2004-2010 Alex Gorbatchev.
 *
 * @license
 * Dual licensed under the MIT and GPL licenses.
 */
;(function()
{
	// CommonJS
	typeof(require) != 'undefined' ? SyntaxHighlighter = require('shCore').SyntaxHighlighter : null;

	function Brush()
	{
		// Created by Peter Atoria @ http://iAtoria.com
	
		var keywords =	'etc it this return yield';
	
		this.regexList = [
			{ regex: SyntaxHighlighter.regexLib.singleLineCComments,	css: 'comments' },		// one line comments
			{ regex: SyntaxHighlighter.regexLib.multiLineCComments,		css: 'comments' },		// multiline comments
			{ regex: SyntaxHighlighter.regexLib.doubleQuotedString,		css: 'string' },		// double quoted strings
			{ regex: /\b[A-z0-9#]+(?=')/gi,								css: 'variable' },		// single quoted strings
			{ regex: /'/gi,												css: 'littlequote' },		// single quoted strings
			{ regex: /[\(\)]/gi,										css: 'color1' },		// round brackets fainter than curlies
			{ regex: /[\{\}]/gi,										css: 'color3' },		// curly brackets very heavy
			{ regex: /[\[\]]/gi,										css: 'color3' },		// square brackets also heavy
			{ regex: /\b([\d]+(\.[\d]+)?|0x[a-f0-9]+)\b/gi,				css: 'value' },			// numbers
			{ regex: /\.\./gi,											css: 'plain' },			// don't treat .. as a function
			{ regex: /(\.\!?\w*[A-Za-z0-9]+)|([A-Za-z0-9]+\w*(?=[\[\(\{]))/gi,	css: 'functions' },		// function calls
			{ regex: /\belse\b/gi,										css: 'functions' },			// else keyword
			{ regex: new RegExp(this.getKeywords(keywords), 'gm'),		css: 'keyword' },		// keywords
			];
	
		this.forHtmlScript(SyntaxHighlighter.regexLib.scriptScriptTags);
	};

	Brush.prototype	= new SyntaxHighlighter.Highlighter();
	Brush.aliases	= ['swym'];

	SyntaxHighlighter.brushes.Swym = Brush;

	// CommonJS
	typeof(exports) != 'undefined' ? exports.Brush = Brush : null;
})();
