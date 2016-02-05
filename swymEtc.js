//=============================================================

SWYM.EtcMatchesExceptChildren = function(leftNode, rightNode)
{
	if ( leftNode === rightNode )
		return true;
	else if ( !leftNode || !rightNode )// !leftNode && !rightNode was caught by the previous case
		return false;
	else if ( leftNode.type !== rightNode.type )
		return false;
	else if ( leftNode.type === "node" )
	{
		return leftNode.op.text === rightNode.op.text &&
				leftNode.op.type === rightNode.op.type &&
				leftNode.children.length === rightNode.children.length;
	}
	else if ( leftNode.type === "fnnode" )
	{
		if( leftNode.argNames.length !== rightNode.argNames.length )
			return false;
			
		if( leftNode.name !== rightNode.name )
		{
			// FIXME - For etc to work, function names have to match exactly... except that for numeric names, we ignore the second and third characters.
			// (to allow for the "th", "nd", "rd" and "st" suffixes.)
			// Ideally, we should be checking whether two functions have identical bodies. Or maybe
			// allow functions to be declared as aliases for each other and just check for aliases here.
			if( leftNode.name[0] !== "#" || rightNode.name[0] !== "#" || leftNode.name.slice(3) !== rightNode.name.slice(3) )
				return false;
		}

		for( var Idx = 0; Idx < leftNode.argNames.length; ++Idx )
		{
			if( leftNode.argNames[Idx] !== rightNode.argNames[Idx] )
				return false;
		}
		
		return true;
	}
	else if ( leftNode.type === "name" )
	{
		return leftNode.text === rightNode.text;
	}
	else if ( leftNode.type === "literal" )
	{
		if ( leftNode.value === rightNode.value )
		{
			return true;
		}
		else if ( leftNode.etcSequence && leftNode.etcSequence[leftNode.etcSequence.length-1] === rightNode.value )
		{
			return true;
		}
		else if ( leftNode.etcSequence || rightNode.etcSequence || 
			(typeof leftNode.value === "number" && typeof rightNode.value === "number") ||
			(typeof leftNode.value === "string" && typeof rightNode.value === "string")
			)
		{
			// NB not true - this value signifies a partial match. see "baseMatch !== true" in SWYM.MergeEtc
			return 1;
		}
	}
}

// returns true for a perfect match, false for no match; for a partial match, returns the number of discrepancies.
SWYM.EtcMatches = function(leftNode, rightNode)
{
	var match = SWYM.EtcMatchesExceptChildren(leftNode, rightNode);
	
	if( !match || !leftNode || (leftNode.type !== "node" && leftNode.type !== "fnnode") )
		return match;

	for( var Idx = 0; Idx < leftNode.children.length; Idx++ )
	{
		var newMatch = SWYM.EtcMatches(leftNode.children[Idx], rightNode.children[Idx]);
		if( !newMatch )
		{
			return false;
		}
		else if ( newMatch !== true )
		{
			if( match === true )
				match = 0;

			match += newMatch;
		}
	}
	
	return match;
}

SWYM.EtcFindBestMatch = function(leftTerm, possibleTerms)
{
	var bestMatchSoFar = false;
	var bestIdx = -1;
	for( var Idx = 0; Idx < possibleTerms.length; Idx++ )
	{
		var newMatch = SWYM.EtcMatches(leftTerm, possibleTerms[Idx]);
		if( newMatch === true && bestMatchSoFar !== true )
		{
			bestMatchSoFar = newMatch;
			bestIdx = Idx;
		}
		else if ( newMatch !== false && bestMatchSoFar !== true && (bestMatchSoFar === false || newMatch < bestMatchSoFar) )
		{
			bestMatchSoFar = newMatch;
			bestIdx = Idx;
		}
	}
	
	return bestIdx;
}

SWYM.CloneNode = function(node, newChildren, etcId, etcExpansionId)
{
	if ( !newChildren )
	{
		newChildren = [];
		for( var Idx = 0; Idx < node.children.length; Idx++ )
			newChildren.push(node.children[Idx]);
	}
	
	if( node.type === "node" )
	    return { type: "node", pos: node.pos, identity: node.identity, text: node.text, op: node.op, children: newChildren, etcExpansionId: etcExpansionId, etcId:etcId };
	else if ( node.type === "fnnode" )
	    return { type: "fnnode", pos: node.pos, identity: node.identity, name: node.name, argNames: node.argNames, children: newChildren, etcExpansionId: etcExpansionId, etcId:etcId };
	else
		SWYM.LogError(node, "Fsckup: invalid node for CloneNode");
}

// nth should be the example number, or "finalExample", or "finalExampleExcluded".
SWYM.MergeEtc = function(leftTerm, rightTerm, nth, etcId)
{
	if( !leftTerm || !rightTerm )
		return false;
	
	var baseMatch = SWYM.EtcMatchesExceptChildren(leftTerm, rightTerm);
	if ( baseMatch !== false )
	{
	    if (leftTerm.etcExpandingSequence !== undefined)
	    {
	        // continuing an expanding sequence term with a sequence
	        var newSequence = [];
	        SWYM.PopulateEtcSequence(rightTerm, newSequence);
	        leftTerm.etcExpandingSequence.push(newSequence);

	        return {
	            type: "literal",
                pos:leftTerm.pos,
	            text: leftTerm.text + "(" + rightTerm.text + ")",
	            etcExpandingSequence: leftTerm.etcExpandingSequence,
	            etcId: leftTerm.etcId
	        };
	    }
	    else if (leftTerm.etcExpansionId !== undefined)
	    {
	        // if this is an expanding expression, rightTerm should be the next step in the expansion.
	        // merge the whole rightTerm together, then merge that with leftTerm.
	        // (which will hopefully trigger the rightTerm.etcSequence code above, but we can't just move
	        // that code in here; the sequence could be embedded in an arbitrarily complex parsetree such as
	        // foo[1].length, foo[1].length+foo[2].length, foo[1].length+foo[2].length+foo[3].length, etc)
	        var collectedResult = { rootNode: leftTerm, exampleChildren: [], finalExample: [], afterEtc: false, recursiveIdx: 0 };
	        SWYM.CollectEtcRec(rightTerm, collectedResult);

	        var mergeResult = collectedResult.baseCase;
	        for (var Idx = 0; Idx < collectedResult.exampleChildren[1].length && mergeResult !== false; ++Idx)
	        {
	            mergeResult = SWYM.MergeEtc(mergeResult, collectedResult.exampleChildren[1][Idx]);
	        }

	        if (mergeResult !== false && leftTerm.type === "fnnode" && leftTerm.children[1] !== undefined && 
                leftTerm.children[1].etcExpandingSequence !== undefined && leftTerm.children[1].etcExpandingSequence.length === 2 &&
                mergeResult.etcSequence !== undefined && mergeResult.etcSequence.length === 2)
	        {
	            //Looks like this is actually an 'omitted start' expression such as 1, 1/2, 1/4, etc
	            var leftTermSequence = leftTerm.children[1].etcExpandingSequence;
	            var lhsSequence = [leftTermSequence[0][0], leftTermSequence[1][0], mergeResult.etcSequence[0]];
	            var rhsSequence = [leftTermSequence[1][1], mergeResult.etcSequence[1]];

	            var lhs = { type: "literal", pos:leftTerm.pos, text: lhsSequence[0] + "/" + lhsSequence[1] + "/" + lhsSequence[2], etcSequence: lhsSequence, etcId: etcId };
	            var rhs = { type: "literal", pos: rightTerm.pos, text: rhsSequence[0] + "/" + rhsSequence[1], etcSequence: rhsSequence, etcId: etcId };
	            var result = SWYM.CloneNode(rightTerm, [lhs, rhs]);
	            result.rhsOmittedStart = true;
	            return result;
            }

	        if (mergeResult !== false)
	            mergeResult = SWYM.MergeEtc(leftTerm.children[1], mergeResult, nth);

	        if (mergeResult !== false)
	        {
	            return SWYM.CloneNode(leftTerm, [SWYM.NewToken("name", 0, "<etcExpansionCurrent>"), mergeResult], leftTerm.etcId, leftTerm.etcExpansionId);
	        }

	        return false;
	    }

	    // recurse to merge the children
		if( rightTerm.type === "node" || rightTerm.type === "fnnode" ) // and by implication, leftTerm is a node too (because they matched)
		{
		    var newChildren = [];
			for( var Idx = 0; Idx < rightTerm.children.length; Idx++ )
			{
			    var mergeResult;

			    if ( leftTerm.children[Idx] === undefined && rightTerm.children[Idx] === undefined )
				{
					mergeResult = undefined;
				}
				else
				{
					mergeResult = SWYM.MergeEtc(leftTerm.children[Idx], rightTerm.children[Idx], nth, etcId);
				}
				
				if( mergeResult === false )
				{
					return false;
				}

				if( mergeResult !== leftTerm.children[Idx] )
				{
					newChildren[Idx] = mergeResult;
				}
			}
			
			if ( newChildren.length > 0 )
			{
				for ( var Idx = 0; Idx < leftTerm.children.length; Idx++ )
				{
					if ( !newChildren[Idx] )
						newChildren[Idx] = leftTerm.children[Idx];
				}

				// differences in children - make a new node
				return SWYM.CloneNode(leftTerm, newChildren, leftTerm.etcId, leftTerm.etcExpansionId);
			}
		}
		else if (rightTerm.etcSequence !== undefined || rightTerm.etcMergeCount !== undefined)
		{
		    var newLhsSequence = [];
		    SWYM.PopulateEtcSequence(leftTerm, newLhsSequence);

		    var newRhsSequence = [];
		    SWYM.PopulateEtcSequence(rightTerm, newRhsSequence);

		    // starting a new expanding sequence term
		    return {
		        type: "literal",
		        pos: leftTerm.pos,
		        text: "(" + SWYM.EtcSequenceToString(newLhsSequence) + ")(" + SWYM.EtcSequenceToString(newRhsSequence) + ")",
		        etcExpandingSequence: [newLhsSequence, newRhsSequence],
		        etcId: leftTerm.etcId
		    };
		}
		else if (leftTerm.type === "literal")
		{
		    if (leftTerm.etcSequence !== undefined || baseMatch !== true) // i.e. baseMatch !== false and !== true: it's a partial match.
		    {
		        // a partially matched literal
		        var newSequence = [];
		        SWYM.PopulateEtcSequence(leftTerm, newSequence);
		        newSequence.push(rightTerm.value);

		        return { type: "literal", pos: leftTerm.pos, text: SWYM.EtcSequenceToString(newSequence), etcSequence: newSequence, etcId: etcId };
		    }
            else
		    {
		        var mergeCount = 2;
		        if (leftTerm.etcMergeCount !== undefined)
		            mergeCount += leftTerm.etcMergeCount - 1;

		        if (rightTerm.etcMergeCount !== undefined)
		            mergeCount += rightTerm.etcMergeCount - 1;

		        return { type: "literal", pos: leftTerm.pos, text: leftTerm.text, value: leftTerm.value, etcMergeCount: mergeCount };
		    }
		}

		// matched perfectly, just use the existing node
		return rightTerm;
	}
	
    // Base match has failed, let's pick up the pieces...

	if( rightTerm.type === "node" || rightTerm.type === "fnnode" )
	{
		// parentheses have no effect and can be ignored. Allows us to match x*(x+1)*etc
		if( rightTerm.op && rightTerm.op.text === "(parentheses())" )
		{
			return SWYM.MergeEtc(leftTerm, rightTerm.children[0], nth, etcId);
		}

		// we're matching a single value with a node; it must be an expanding sequence where the
		// rightTerm was spliced in, or else can't match

		// this kind of splice is only legal if we do it in the first step
		if( nth !== 1 )
			return false;
			
		var BestIdx = SWYM.EtcFindBestMatch(leftTerm, rightTerm.children);
		if ( BestIdx === -1 )
		{
			//SWYM.LogError(rightTerm, "Ambiguous etc expression - no obvious matches");
			return false;
		}
		else
		{
			var expansionId = etcId+1;
			
			if( rightTerm.children.length === 2 )
			{
				var mergedRightChildren = SWYM.MergeEtc(rightTerm.children[0], rightTerm.children[1], 1, expansionId);
			}
			else
			{
				var mergedRightChildren = false;
			}
			
			if( mergedRightChildren === false )
			{
				//SWYM.LogError(0, "Failed to merge expanding sequence: ["+rightTerm.children[0]+","+rightTerm.children[1]+"]");
				return false;
			}
			
			var mergedChild = SWYM.MergeEtc(leftTerm, mergedRightChildren, nth, etcId);

			return SWYM.CloneNode(rightTerm, [SWYM.NewToken("name", 0, "<etcExpansionCurrent>"), mergedChild], etcId, expansionId);
		}
	}

	return false;
}

SWYM.PopulateEtcSequence = function (literalTerm, etcSequence)
{
    if (literalTerm.etcSequence !== undefined)
    {
        for (var Idx = 0; Idx < literalTerm.etcSequence.length; ++Idx)
        {
            etcSequence.push(literalTerm.etcSequence[Idx]);
        }
    }
    else
    {
        etcSequence.push(literalTerm.value);

        if (literalTerm.etcMergeCount !== undefined)
        {
            for (var Idx = 1; Idx < literalTerm.etcMergeCount; ++Idx)
            {
                etcSequence.push(literalTerm.value);
            }
        }
    }
}

SWYM.EtcSequenceToString = function (etcSequence)
{
    var result = "" + etcSequence[0];
    for (var Idx = 1; Idx < etcSequence.length; ++Idx)
    {
        result += "/"+etcSequence[Idx];
    }
    return result;
}

SWYM.HALT_AFTER = 2;
SWYM.HALT_BEFORE = 1;
SWYM.HALT_NO = 0;

SWYM.HaltCondition = function(test, haltValue)
{
	return function(currentValue, terminatorValue, currentIndex)
	{
		var c = test(currentValue, terminatorValue);
		if ( c && c.value )
			return haltValue;
		else
			return SWYM.HALT_NO;
	}
}

SWYM.CollectEtc = function(parsetree, etcRoot, etcId)
{
    if (!etcRoot)
		return parsetree;
	
	var collectedResult = { rootNode: etcRoot, exampleChildren: [], finalExample: [], afterEtc: false, recursiveIdx: 0 };
	
	if( parsetree.arbitraryRecursion )
	{
	    collectedResult.recursiveIdx = undefined;
	}
		
	if (etcRoot.children && etcRoot.children[1] !== undefined)
	{
	    collectedResult.finalExample.push(etcRoot.children[1]);
	}
	
	if (etcRoot === parsetree)
	{
		// left-associative op: the etc node is the root, and its left child is the examples
		var childNode = parsetree.children[0];
		if (SWYM.IsContinuingEtc(childNode, collectedResult))
		{
		    SWYM.CollectEtcRec(parsetree.children[0], collectedResult);
		}
		else
		{
            // Apparently it's an etc expression with only one example.
		    collectedResult.baseCase = childNode;
		    collectedResult.exampleChildren = [undefined, [childNode]];
		}
	}
	else
	{
		// right-associative op: the node we found is the root, and its right child contains the current etcRoot 
	    SWYM.CollectEtcRec(parsetree, collectedResult);
	}
	
	if (collectedResult.finalExample.length > 1)
	{
	    SWYM.LogError(parsetree, "Too many additional terms after " + etcRoot.etc + " expression (required 1, got " + collectedResult.finalExample.length + ")");
	}
	else if (etcRoot.etc === 'etc' && collectedResult.finalExample.length !== 0)
	{
	    SWYM.LogError(parsetree, "Cannot have additional terms after " + etcRoot.etc + " expression");
	}
	else if (etcRoot.etc !== 'etc' && etcRoot.etc !== 'etc..' && collectedResult.finalExample.length !== 1)
	{
	    SWYM.LogError(parsetree, "Fsckup: Invalid number of final examples for " + etcRoot.etc + " expression (required 1, got " + collectedResult.finalExample.length + ")");
	}
	
	var children = [];
	if (collectedResult.recursiveIdx !== undefined)
	{
	    children[collectedResult.recursiveIdx] = SWYM.NewToken("name", parsetree.pos, "<etcSoFar>");
	}
	
	// if there's exactly one child, merge the base case with it (and if that fails, try treating them separately.)
	//
	// OMG, huge problem: 1+2+3+etc**5 vs x+2+3+etc**5. Former should do 1+2+3+4+5, latter does x+2+3+4+5+6.
	// is that weird? What if someone realizes x is always 1 and writes it in, expecting the meaning to be the same?
	//
	// other problem - 1+2+8+etc ... what sequence is that? 1+2+8+14, where 1 is just excluded?
	// ...no? if we fail at the number matching stage, we can't backtrack up to this "treat them separately" stage.
	//
	// ok, I guess that answers both questions. User just has to keep that in mind if they want to rewrite x -> 1.
	// hopefully it should be fairly clear that it changes the meaning.
	if (collectedResult.recursiveIdx !== undefined && collectedResult.exampleChildren.length == 2)
	{
	    var examples = collectedResult.exampleChildren[1 - collectedResult.recursiveIdx];

	    var merged = collectedResult.baseCase;
		for( var Idx = 0; Idx < examples.length && merged !== false; Idx++ )
		{
			merged = SWYM.MergeEtc(merged, examples[Idx], Idx+1, etcId);
		}
		
		if( merged !== false )
		{
			// success! keep that.
		    children[1 - collectedResult.recursiveIdx] = merged;
		    collectedResult.exampleChildren[1 - collectedResult.recursiveIdx] = undefined;
		    collectedResult.mergedBaseCase = true;
		}
		else
		{
			// ok, try it without the basecase.
			var merged = examples[0];
			for( var Idx = 1; Idx < examples.length; Idx++ )
			{
				merged = SWYM.MergeEtc(merged, examples[Idx], Idx, etcId);
			}
			
			if( merged !== false )
			{
				// success! keep that.
			    children[1 - collectedResult.recursiveIdx] = merged;
			    collectedResult.exampleChildren[1 - collectedResult.recursiveIdx] = undefined;
			    collectedResult.mergedBaseCase = false;
			}
		}
	}
	else if (collectedResult.exampleChildren.length === 0)
	{
	    // it's an etc operation with only one term (a basecase).
	    // For simplicity, let's copy it into the examples.
	    collectedResult.exampleChildren[1] = [collectedResult.baseCase];
	    collectedResult.mergedBaseCase = true;
	}

	for (var childIdx = 0; childIdx < collectedResult.exampleChildren.length; ++childIdx)
	{
	    var examples = collectedResult.exampleChildren[childIdx];

		if( examples === undefined )
		{
			continue;
		}
		
		if( examples.length < 1 || examples.length > 4 )
		{
			// we allow 1-4 terms before
			SWYM.LogError(parsetree, "Invalid number of terms before "+etcRoot.etc+" (allowed 1-4 terms, got "+examples.length+")");
		}
		else
		{
			var merged = examples[0];
			for( var Idx = 1; Idx < examples.length; Idx++ )
			{
				merged = SWYM.MergeEtc(merged, examples[Idx], Idx, etcId);
			}

			if ( !merged )
			{
				SWYM.LogError(parsetree, "Failed to extrapolate etc sequence for "+parsetree);
			}
			
			// check for nested etc expressions
			//result = SWYM.FindAndProcessEtc(result, etcId+1);
			children[childIdx] = merged;
		}
	}

	var body;
	if( etcRoot.type === "fnnode" )
	{
	    if (etcRoot.children[0].type === "fnnode" && etcRoot.name === etcRoot.children[0].name)
	    {
	        body = { type: "fnnode", argNames: etcRoot.children[0].argNames, children: children, name: etcRoot.name };
	    }
	    else
	    {
	        body = { type: "fnnode", argNames: etcRoot.argNames, children: children, name: etcRoot.name };
	    }
	}
	else
	{
		body = {type:"node", op:etcRoot.op, children:children};
	}

	return {
		type:"etc",
		etcType:etcRoot.etc,
		baseCase: collectedResult.baseCase,
		mergedBaseCase: collectedResult.mergedBaseCase,
		body:body,
		rhs: collectedResult.finalExample[0],
		etcId:etcId
	};
}

SWYM.IsContinuingEtc = function (parsetree, collectedResult)
{
    return (parsetree.type === "node" && collectedResult.rootNode.type === "node" && parsetree.op.text === collectedResult.rootNode.op.text) ||
        (parsetree.type === "fnnode" && collectedResult.rootNode.type === "fnnode" && parsetree.name === collectedResult.rootNode.name);
}

SWYM.CollectEtcRec = function (parsetree, collectedResult)
{
	if( !parsetree )
		return;
		
	var idxLimit = parsetree.children.length;
	if( idxLimit > 1 && parsetree.op !== undefined && parsetree.op.etc !== undefined )
	{
		for( var Idx = 1; Idx < idxLimit; Idx++ )
		{			
		    collectedResult.finalExample.push(parsetree.children[Idx]);
		}
		idxLimit = 1;
	}
	
	for( var Idx = 0; Idx < idxLimit; Idx++ )
	{
		var childNode = parsetree.children[Idx];
		if (SWYM.IsContinuingEtc(childNode, collectedResult))
		{
		    if (Idx !== collectedResult.recursiveIdx && collectedResult.recursiveIdx !== undefined)
			{
				SWYM.LogError(childNode, "Inconsistent recursion in etc!");
			}
			
		    collectedResult.recursiveIdx = Idx;
		    SWYM.CollectEtcRec(childNode, collectedResult);
		}
		else if (Idx === collectedResult.recursiveIdx && collectedResult.recursiveIdx !== undefined)
		{
		    if (collectedResult.baseCase === undefined)
			{
		        collectedResult.baseCase = childNode;
			}
			else
			{
				SWYM.LogError(childNode, "Fsckup: Too many base cases for etc sequence!?");
			}
		}
		else
		{
		    if (collectedResult.exampleChildren[Idx] === undefined)
			{
		        collectedResult.exampleChildren[Idx] = [];
			}
		    collectedResult.exampleChildren[Idx].push(parsetree.children[Idx]);
		}
	}

	if((parsetree.op && parsetree.op.etc) || (parsetree.type === "fnnode" && parsetree.etc))
	{
	    if (collectedResult.afterEtc)
			SWYM.LogError(parsetree, "Cannot have more than one etc per sequence!");

		if( parsetree.op && parsetree.op.etc === "etc" )
		    collectedResult.stopCollecting = true;
		else if( parsetree.type === "fnnode" && parsetree.etc === "etc" )
		    collectedResult.stopCollecting = true;

		collectedResult.afterEtc = true;
	}
}

SWYM.FindAndProcessEtcRec = function(parsetree, etcId)
{
	if( !parsetree )
		return;

	if( parsetree.type === "node" || parsetree.type === "fnnode" )
	{
		if( parsetree.etc || (parsetree.op && parsetree.op.etc))
			return parsetree; //found an etc node! Notify the caller.

		var etcRoot;
		for( var Idx = 0; Idx < parsetree.children.length; Idx++ )
		{
		    etcRoot = SWYM.FindAndProcessEtcRec(parsetree.children[Idx], etcId);
		    if (etcRoot)
			{
		        if (parsetree.op && etcRoot.op && etcRoot.op.text === parsetree.op.text)
				{
					// this continues an etc node! Notify the caller.
		            return etcRoot;
				}
		        else if (parsetree.type === "fnnode" && etcRoot.type === "fnnode" && etcRoot.name === parsetree.name)
				{
					// this continues an etc function! Notify the caller.
		            return etcRoot;
				}
				else
				{
					// we have found the limit of this whole etc - now process it.
		            parsetree.children[Idx] = SWYM.CollectEtc(parsetree.children[Idx], etcRoot, etcId);
				}
			}
		}
		
		if( parsetree.body )
		{
			parsetree.body = SWYM.CollectEtc(parsetree.body, SWYM.FindAndProcessEtcRec(parsetree.body, etcId), etcId);
		}
	}
}

SWYM.FindAndProcessEtc = function(parsetree, etcId)
{
	var etcRoot = SWYM.FindAndProcessEtcRec(parsetree, etcId);
	if( etcRoot )
		return SWYM.CollectEtc(parsetree, etcRoot, etcId);
	else
		return parsetree;
}

SWYM.EtcTryGenerator = function(sequence, generator)
{  
	for(var Idx = 0; Idx < sequence.length; Idx++ )
	{
		var resultAtIdx = generator(Idx);
		if( !SWYM.IsEqual(resultAtIdx, sequence[Idx]) )
			return false;
	}
	
	return true;
}

SWYM.EtcTryNumberGenerator = function(sequence, generator)
{  
	for(var Idx = 0; Idx < sequence.length; Idx++ )
	{
		var resultAtIdx = generator(Idx);
		if( resultAtIdx + 0.0000000001 < sequence[Idx] || resultAtIdx - 0.0000000001 > sequence[Idx] || isNaN(resultAtIdx))
			return false;
	}
	
	return true;
}

SWYM.EtcCreateExpandingGenerator = function (expandingSequence, errorNode)
{
	// simple rule: build a generator for the longest sequence,
	// and then check that all the others match the stem/tail of it.
	// This handles sequences like [[1],[1,2],[1,2,3],etc]
    // and [[1],[2,1],[3,2,1],etc]
    for (var Idx = 0; Idx < expandingSequence.length; ++Idx)
    {
        if (expandingSequence[Idx].length !== Idx+1)
        {
            SWYM.LogError(errorNode, "Don't know how to extrapolate from this pattern: " + expandingSequence);
            return;
        }
    }

	var longestSequence = expandingSequence[expandingSequence.length-1];

	var forwardGenerator = SWYM.EtcCreateGenerator(longestSequence, undefined);
	expandingSequence.type = longestSequence.type;

	var reverseGenerator = undefined;
	if (forwardGenerator !== undefined)
	{
	    longestSequence.reverse();
	    reverseGenerator = SWYM.EtcCreateGenerator(longestSequence, undefined);
	    longestSequence.reverse();
	}

	if (forwardGenerator === undefined && reverseGenerator === undefined)
	{
        // report the error
	    SWYM.EtcCreateGenerator(longestSequence, errorNode);
	}

	var matchesStem = (forwardGenerator !== undefined);
	var matchesTail = (reverseGenerator !== undefined);
	
	for(var expIdx = 0; expIdx < expandingSequence.length-1; ++expIdx)
	{
		var subSequence = expandingSequence[expIdx];
		var lengthOffset = longestSequence.length - subSequence.length;
		for(var subIdx = 0; subIdx < subSequence.length; ++subIdx)
		{
			if( matchesStem )
			{
				matchesStem = SWYM.IsEqual(subSequence[subIdx], longestSequence[subIdx]);
			}
			else if( !matchesTail )
			{
				break;
			}
			
			if( matchesTail )
			{
				matchesTail = SWYM.IsEqual(subSequence[subIdx], longestSequence[lengthOffset+subIdx]);
			}
		}
	}
	
	if( matchesStem )
	{
		return function(expIdx, subIdx)
		{
			return forwardGenerator(subIdx);
		};
	}
	
	if( matchesTail )
	{
		return function(expIdx, subIdx)
		{
			return reverseGenerator(expIdx-subIdx);
		};
	}
	
	// Try flattening the seuquence and applying the generator to it as a whole.
	// This handles sequences like [[1], [2,3], [4,5,6], etc]
	var flattened = Array.prototype.concat.apply([], expandingSequence);
	var flattenedGenerator = SWYM.EtcCreateGenerator(flattened, errorNode);
	
	if( flattenedGenerator !== undefined )
	{
		return function(expIdx, subIdx)
		{
			return flattenedGenerator( (expIdx*expIdx + expIdx)/2 + subIdx ) ;
		}
	}
	
	SWYM.LogError(errorNode, "etc - can't find a rule for sequence [" + expandingSequence + "].");
	return undefined;
}

SWYM.EtcCreateGenerator = function (sequence, errorNode)
{
	if( typeof(sequence[0]) === "string" )
	{
		// string sequences
	    return SWYM.EtcCreateStringGenerator(sequence, errorNode)
	}
	else if( typeof(sequence[0]) === "number" )
	{
		// number sequences
	    return SWYM.EtcCreateNumberGenerator(sequence, errorNode)
	}
}

SWYM.EtcCreateStringGenerator = function (sequence, errorNode)
{
	var base = sequence[0];
	sequence.type = SWYM.StringType;

	if( sequence.length === 1 )
	{
		return function(index){ return base; };
	}
	
	// Valid rules for string generators:
	//
	// letters progress through the alphabet in sequence (automatically end after Z?)
	var second = sequence[1];
	
	if( base.length === second.length )
	{
		var offsets = [];
		for(var Idx = 0; Idx < base.length; Idx++ )
		{
			offsets[Idx] = (second.charCodeAt(Idx) - base.charCodeAt(Idx));
		}
		
		var sequenceFn = function(index)
		{
			var result = "";
			for(var Idx = 0; Idx < base.length; ++Idx )
			{
				result += String.fromCharCode( base.charCodeAt(Idx) + offsets[Idx]*index );
			}
			return result;
		};
		
		// this will match all 2-element sequences.
		if ( SWYM.EtcTryGenerator(sequence, sequenceFn) )
		{
			return function(index){ return SWYM.StringWrapper( sequenceFn(index) ); };
		}
	}
	
	SWYM.LogError(errorNode, "etc - can't find a rule for sequence ["+sequence+"].");
   	return undefined;
}

SWYM.EtcCreateNumberGenerator = function (sequence, errorNode)
{
	var base = sequence[0];
	
	if( sequence.length === 1 )
	{
		sequence.type = (base%1==0)? SWYM.IntType: SWYM.NumberType;
		
		if( sequence.finalExample !== undefined && sequence.finalExample < base )
		{
			sequence.direction = "descending";
			return function(index){ return base - index; };
		}
		else
		{
			sequence.direction = "ascending";
			return function(index){ return base + index; };
		}
	}
		
	var second = sequence[1];
	var arithmetic = function(index){ return base + (second-base)*index; };
	
	// this will match all 2-element sequences.
	if ( SWYM.EtcTryNumberGenerator(sequence, arithmetic) )
	{
		if( second > base )
			sequence.direction = "ascending";
		else if ( second < base )
			sequence.direction = "descending";
			
		sequence.type = (base%1==0 && second%1==0)? SWYM.IntType: SWYM.NumberType;

		return arithmetic;
	}

	if (base != 0 )
	{
		var geometric = function(index){ return base * Math.pow(second/base, index); };

		if (SWYM.EtcTryNumberGenerator(sequence, geometric ))
		{
			if( second > base )
				sequence.direction = "ascending";
			else if ( second < base )
				sequence.direction = "descending";
				
			sequence.type = (base%1==0 && (second/base)%1==0)? SWYM.IntType: SWYM.NumberType;
			
			return geometric;
		}
	}
	
	var third = sequence[2];
	var firstDiff = second-base;
	var term4s = [];
	
	// try a quadratic sequence, e.g. 1, 3, 7, 10
	var firstDiff = second-base;
	var pDiff = (third-second) - firstDiff;
	var quadratic = function(index){
		return base + firstDiff*index + pDiff*index*(index-1)/2;
	};

	// only try this when there are 4 examples, because literally all 3-value sequences can fit a quadratic sequence.
	if( sequence.length >= 4 && SWYM.EtcTryNumberGenerator(sequence, quadratic))
	{
		if( firstDiff >= 0 && pDiff >= 0 )
			sequence.direction = "ascending";
		else if ( firstDiff <= 0 && pDiff <= 0 )
			sequence.direction = "descending";
			
		sequence.type = (base%1==0 && firstDiff%1==0 && pDiff%1==0)? SWYM.IntType: SWYM.NumberType;

		return quadratic;
	}
	else
	{
		term4s["quadratic"] = quadratic(3);
	}

	var factor = (third-second) / firstDiff;
	var lastIndex = 0;
	var lastValue = base;

	// try a cumulative geometric sequence, e.g. 1, 11, 111, 1111, etc
	// feels like there should be a simpler way to generate it than this. :-/
	// also, doing it this way accumulates some nasty floating point errors.
	var cumgeometric = function(index)
	{
		if( lastIndex > index )
		{
			lastIndex = 0;
			lastValue = base;
		}
		
		while( lastIndex < index )
		{
			lastValue += firstDiff*Math.pow(factor, lastIndex);
			lastIndex++;
		}
		return lastValue;
	};

	if (SWYM.EtcTryNumberGenerator(sequence, cumgeometric))
	{
	    if (sequence.length >= 4)
	    {
	        if (factor > 0)
	        {
	            if (firstDiff > 0)
	                sequence.direction = "ascending";
	            else if (firstDiff < 0)
	                sequence.direction = "descending";
	        }

	        sequence.type = (base % 1 == 0 && firstDiff % 1 == 0 && factor % 1 == 0) ? SWYM.IntType : SWYM.NumberType;

	        return cumgeometric;
	    }
	    else
	    {
	        term4s["cumulative geometric"] = cumgeometric(3);
	    }
	}

	// try the factorial sequence, i.e. 1, 2, 6, 24, etc
	var factorialSeq = function(index)
	{
		var result = 1;
		while(index >= 0)
		{
			result *= index+1;
			index--;
		}
		return result;
	};

	if (SWYM.EtcTryNumberGenerator(sequence, factorialSeq))
	{
	    if (sequence.length >= 4)
	    {
	        sequence.type = SWYM.IntType;
	        return factorialSeq;
	    }
	    else
	    {
	        term4s["factorial"] = factorialSeq(3);
	    }
	}

    // try the fibonacci sequence, i.e. 1, 1, 2, 3, 5, etc
	var fibonacciSeq = function (index)
	{
	    var a = 0;
	    var b = 1;
	    while (index > 0)
	    {
	        a = a + b;
	        b = a + b;
	        index-=2;
	    }

	    if (index == 0)
	        return b;
	    return a;
	};

	if (SWYM.EtcTryNumberGenerator(sequence, fibonacciSeq))
	{
	    if (sequence.length >= 4)
	    {
	        sequence.type = SWYM.IntType;
	        return fibonacciSeq;
	    }
	    else
	    {
	        term4s["fibonacci"] = fibonacciSeq(3);
	    }
	}

	// try an arithmetic times geometric sequence, e.g. 1, 20, 300, 4000, etc
	var sqrtTerm = Math.sqrt(1 + 1/((second*second/(base*third)) - 1)); // math, how does it even work, amirite
	if(!isNaN(sqrtTerm))
	{
		var arithStep = -base / ( 1-sqrtTerm );
		var geoFactor = second/(base+arithStep)
		var arithxgeo = function(index)
		{
			return (base + arithStep*index) * Math.pow(geoFactor, index);
		};

		if( sequence.length >= 4 && SWYM.EtcTryNumberGenerator(sequence, arithxgeo))
		{
			sequence.type = (base%1==0 && arithStep%1==0 && geoFactor%1==0)? SWYM.IntType: SWYM.NumberType;

			return arithxgeo;
		}
		else
		{
			var soln = arithxgeo(3);
			if( !isNaN(soln) )
			{
				term4s["arithmetic * geometric"] = soln;
			}
		}

		// arithxgeo formula has two solutions - plus or minus sqrt.
		var arithStepB = -base / ( 1+sqrtTerm )
		var geoFactorB = second/(base+arithStepB)
		var arithxgeoB = function(index)
		{
			return (base + arithStepB*index) * Math.pow(geoFactorB, index);
		};

		if( sequence.length >= 4 && SWYM.EtcTryNumberGenerator(sequence, arithxgeoB))
		{
			sequence.type = (base%1==0 && arithStepB%1==0 && geoFactorB%1==0)? SWYM.IntType: SWYM.NumberType;

			return arithxgeoB;
		}
		else
		{
			var soln = arithxgeoB(3);
			if( !isNaN(soln) )
			{
				term4s["a*g, 2nd solution"] = soln;
			}
		}
	}
   	
	if (errorNode !== undefined)
	{
	    if (sequence.length == 3)
	    {
	        var contList = "";
	        for (var title in term4s)
	        {
	            if (contList !== "")
	                contList += ", ";

	            contList += term4s[title] + " (" + title + ")";
	        }

	        SWYM.LogError(errorNode, "etc - ambiguous sequence [" + sequence + "]. Please provide a 4th term. Known ways to continue this sequence: " + contList);
	    }
	    else
	    {
	        SWYM.LogError(errorNode, "etc - can't find a rule for sequence [" + sequence + "].");
	    }
	}
   	return undefined;
}

SWYM.onLoad("swymEtc.js");