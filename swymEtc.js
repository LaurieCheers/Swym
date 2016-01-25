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

SWYM.CloneNode = function(node, newChildren)
{
	if ( !newChildren )
	{
		newChildren = [];
		for( var Idx = 0; Idx < node.children.length; Idx++ )
			newChildren.push(node.children[Idx]);
	}
	
	if( node.type === "node" )
		return {type:"node", text:node.text, op:node.op, children:newChildren};
	else if ( node.type === "fnnode" )
		return {type:"fnnode", name:node.name, children:newChildren, argNames:node.argNames};
	else
		SWYM.LogError(0, "Fsckup: invalid node for CloneNode");
}

SWYM.ConsiderOmittedStart = function(leftTerm, rightTerm)
{
	// This handles a specific type of sequence at a particular point in the processing.
	// leftTerm = (single term; then term|op|whatever); rightTerm = term|op|whatever.
	// e.g. 1, 1/2, 1/4, etc   or   10, 10+1, 10+2, etc
	if( leftTerm.etcExpandAround === undefined )
		return false;

	var omittedIdx = -1;
	var omittedValue = null;
	if ( leftTerm.op.text === "*" || (leftTerm.op.text === "/" && leftTerm.etcExpandAround === 0) )
	{
		omittedIdx = 1-leftTerm.etcExpandAround;
		omittedValue = 1;
	}
	else if ( leftTerm.op.text === "+" || (leftTerm.op.text === "-" && leftTerm.etcExpandAround === 0) )
	{
		omittedIdx = 1-leftTerm.etcExpandAround;
		omittedValue = 0;
	}
	
	if( omittedIdx === -1 )
		return false;
					
	var omittedLhs = leftTerm.children[omittedIdx];
	var omittedRhs = rightTerm.children[omittedIdx];
	if ( omittedLhs && omittedLhs.type === "literal" && omittedRhs && omittedRhs.type === "literal" )
	{
		var newChildren = [];
		for( var Idx = 0; Idx < leftTerm.children.length; Idx++ )
		{
			if( Idx !== omittedIdx )
			{
				newChildren.push(leftTerm.children[Idx]);
			}
			else
			{
				var newChild = {
					type:"literal",
					text:""+omittedValue+"/"+leftTerm.children[Idx].text+"/"+rightTerm.children[Idx].text,
					etcSequence:[omittedValue]
				};

				if( leftTerm.children[Idx].etcSequence )
					newChild.etcSequence = newChild.etcSequence.concat(leftTerm.children[Idx].etcSequence);
				else
					newChild.etcSequence.push(leftTerm.children[Idx].value);
				
				newChild.etcSequence.push(rightTerm.children[Idx].value);
				
				newChildren.push(newChild);
			}
		}

		//NB this intentionally discards the node's "etcExpandAround" tag.
		return {type:"node",text:leftTerm.text,op:leftTerm.op, children:newChildren};
	}

	return false;
}

// nth should be the example number, or "finalExample", or "finalExampleExcluded".
SWYM.MergeEtc = function(leftTerm, rightTerm, nth, etcId)
{
	if( !leftTerm || !rightTerm )
		return false;
	
	var baseMatch = SWYM.EtcMatchesExceptChildren(leftTerm, rightTerm);
	if ( baseMatch )
	{
		// recurse to merge the children
		if( rightTerm.type === "node" || rightTerm.type === "fnnode" ) // and by implication, leftTerm is a node too (because they matched)
		{
			var newChildren = [];
			for( var Idx = 0; Idx < rightTerm.children.length; Idx++ )
			{
				var mergeResult;

				if ( leftTerm.etcExpandAround === Idx && nth > 1 )
				{
					// if the expression expands around this child, that means this child on the right hand side
					// should match the entire left hand side
					if ( !SWYM.EtcMatches(leftTerm, SWYM.MergeEtc(leftTerm, rightTerm.children[Idx], nth-1, etcId)))
						return false;
					
					// bizarre Firefox bug!? - if I don't use a temp variable here,
					// we get an undefined mergeResult.
					var huh = leftTerm;
					mergeResult = huh.children[Idx];
				}
				else if ( leftTerm.etcExpandAround !== undefined && nth >= 0 )
				{
					// if the expression expands around another child, that means this term gets appended at
					// each iteration. Merge this with previous appended terms.
					mergeResult = SWYM.MergeEtc(leftTerm.children[Idx], rightTerm.children[Idx], nth-1, etcId);
				}
				else if ( leftTerm.children[Idx] === undefined && rightTerm.children[Idx] === undefined )
				{
					mergeResult = undefined;
				}
				else
				{
					mergeResult = SWYM.MergeEtc(leftTerm.children[Idx], rightTerm.children[Idx], nth, etcId);
				}
				
				if( mergeResult === false )
				{
					if ( leftTerm.etcExpandAround !== undefined && nth === 2 )
						return SWYM.ConsiderOmittedStart(leftTerm, rightTerm);
					else
						return false; // can't merge
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
				return SWYM.CloneNode(leftTerm, newChildren);
			}
		}
		else if ( baseMatch !== true )
		{
			if( leftTerm.etcExpandingSequence !== undefined )
			{
				leftTerm.etcExpandingSequence.push(rightTerm.etcSequence);
				
				// continuing an expanding sequence term
				return {
					type:"literal",
					text:leftTerm.text+"("+rightTerm.text+")",
					etcExpandingSequence:leftTerm.etcExpandingSequence,
					expandingId:etcId,
					etcId:leftTerm.etcId
				};
			}
			else if( rightTerm.etcSequence !== undefined )
			{
				var etcExpandingSequence = [];
				if( leftTerm.etcSequence !== undefined )
				{
					etcExpandingSequence.push(leftTerm.etcSequence);
				}
				else
				{
					etcExpandingSequence.push([leftTerm.value]);
				}
				etcExpandingSequence.push(rightTerm.etcSequence);
				etcExpandingSequence.type = rightTerm.etcSequence.type;
				
				// starting a new expanding sequence term
				return {
					type:"literal",
					text:"("+leftTerm.text+")("+rightTerm.text+")",
					etcExpandingSequence:etcExpandingSequence,
					expandingId:etcId,
					etcId:leftTerm.etcId
				};
			}
			else
			{
				// a partially matched literal
				var etcSequence = [];
				var oldSeq = leftTerm.etcSequence;
				
				if ( oldSeq )
				{
					for(var elem in oldSeq)
						etcSequence.push(oldSeq[elem]);
				}
				else if ( nth === 0 || nth > 1 )
				{
					// can only start a new etcSequence when nth == 1
					// (i.e. when we're seeing the second term of the sequence)
					return false;
				}
				else
				{
					etcSequence.push(leftTerm.value);
				}

				if( nth === "finalExample" )
				{
					etcSequence.finalExample = rightTerm.value;
					etcSequence.excludeFinalExample = false;
				}
				else if( nth === "finalExampleExcluded" )
				{
					etcSequence.finalExample = rightTerm.value;
					etcSequence.excludeFinalExample = true;
				}
				else
				{
					etcSequence.push(rightTerm.value);
				}
					
				return {type:"literal", text:leftTerm.text+"/"+rightTerm.text, etcSequence:etcSequence, etcId:etcId};
			}
		}

		// matched perfectly, just use the existing node
		return rightTerm;
	}
	
	if( rightTerm.type === "node" || rightTerm.type === "fnnode" )
	{
		// parentheses have no effect and can be ignored
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

			if( rightTerm.type === "node" )
			{
				return {type:"node",
					pos:rightTerm.pos,
					identity:rightTerm.identity,
					text:rightTerm.text,
					op:rightTerm.op,
					children:[SWYM.NewToken("name", 0, "<etcExpansionCurrent>"), mergedChild],
					etcExpansionId:expansionId,
					etcId:etcId};
			}
			else // rightTerm.type === "fnnode"
			{
				return {type:"fnnode",
					pos:rightTerm.pos,
					identity:rightTerm.identity,
					name:rightTerm.name,
					argNames:rightTerm.argNames,
					children:[SWYM.NewToken("name", 0, "<etcExpansionCurrent>"), mergedChild],
					etcExpansionId:expansionId,
					etcId:etcId};
			}
		}
	}

	return false;
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

SWYM.CollectEtc = function(parsetree, etcOp, etcId)
{
	if( !etcOp )
		return parsetree;
	
	var collected = {op:etcOp, exampleChildren:[], finalExample:[], afterEtc:false, recursiveIdx:0};
	
	if( parsetree.arbitraryRecursion )
	{
		collected.recursiveIdx = undefined;
	}
		
	if( etcOp.children && etcOp.children[1] !== undefined )
	{
		collected.finalExample.push(etcOp.children[1]);
	}
	
	if( etcOp === parsetree )
	{
		// left-associative op: the etc node is the root, and its left child is the examples
		var childNode = parsetree.children[0];
		if( (childNode.type === "node" && childNode.op.text === collected.op.text) ||
			(collected.op.type === "fnnode" && childNode.name === collected.op.name))
		{
			SWYM.CollectEtcRec(parsetree.children[0], collected);
		}
		else
		{
            // Apparently it's an etc expression with only one example.
		    collected.baseCase = childNode;
		    collected.exampleChildren = [undefined, [childNode]];
		}
	}
	else
	{
		// right-associative op: the node we found is the root, and its right child contains the etcOp 
		SWYM.CollectEtcRec(parsetree, collected);
	}
	
	if (collected.finalExample.length > 1)
	{
		SWYM.LogError(parsetree.pos, "Too many additional terms after "+etcOp.etc+" expression (required 1, got "+collected.finalExample.length+")");
	}
	else if (etcOp.etc === 'etc' && collected.finalExample.length !== 0)
	{
		SWYM.LogError(parsetree.pos, "Cannot have additional terms after "+etcOp.etc+" expression");
	}
	else if (etcOp.etc !== 'etc' && etcOp.etc !== 'etc..' && collected.finalExample.length !== 1)
	{
		SWYM.LogError(parsetree.pos, "Fsckup: Invalid number of final examples for "+etcOp.etc+" expression (required 1, got "+collected.finalExample.length+")");
	}
	
	var children = [];
	if( collected.recursiveIdx !== undefined )
	{
		children[collected.recursiveIdx] = SWYM.NewToken("name", parsetree.pos, "<etcSoFar>");
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
	if( collected.exampleChildren.length == 2 )
	{
		var examples = collected.exampleChildren[1-collected.recursiveIdx];

		var merged = collected.baseCase;
		for( var Idx = 0; Idx < examples.length; Idx++ )
		{
			merged = SWYM.MergeEtc(merged, examples[Idx], Idx+1, etcId);
		}
		
		if( merged !== false )
		{
			// success! keep that.
			children[1-collected.recursiveIdx] = merged;
			collected.exampleChildren[1-collected.recursiveIdx] = undefined;
			collected.mergedBaseCase = true;
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
				children[1-collected.recursiveIdx] = merged;
				collected.exampleChildren[1-collected.recursiveIdx] = undefined;
				collected.mergedBaseCase = false;
			}
		}
	}
	else if (collected.exampleChildren.length === 0)
	{
	    // it's an etc operation with only one term (a basecase).
	    // For simplicity, let's copy it into the examples.
	    collected.exampleChildren[1] = [collected.baseCase];
	    collected.mergedBaseCase = true;
	}

	for( var childIdx = 0; childIdx < collected.exampleChildren.length; ++childIdx )
	{
		var examples = collected.exampleChildren[childIdx];

		if( examples === undefined )
		{
			continue;
		}
		
		if( examples.length < 1 || examples.length > 4 )
		{
			// we allow 1-4 terms before
			SWYM.LogError(parsetree.pos, "Invalid number of terms before "+etcOp.etc+" (allowed 1-4 terms, got "+examples.length+")");
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
				SWYM.LogError(parsetree.pos, "Failed to extrapolate etc sequence for "+parsetree);
			}
			
			// check for nested etc expressions
			//result = SWYM.FindAndProcessEtc(result, etcId+1);
			children[childIdx] = merged;
		}
	}

	var body;
	if( etcOp.type === "fnnode" )
	{
	    body = { type: "fnnode", argNames: etcOp.argNames, children: children, name: etcOp.name };

	    // TODO: why was it accessing etcOp.children[0].argNames? Was that just wrong?
	    // body = { type: "fnnode", argNames: etcOp.children[0].argNames, children: children, name: etcOp.name };
	}
	else
	{
		body = {type:"node", op:etcOp, children:children};
	}

	return {
		type:"etc",
		etcType:etcOp.etc,
		baseCase:collected.baseCase,
		mergedBaseCase:collected.mergedBaseCase,
		body:body,
		rhs:collected.finalExample[0],
		etcId:etcId
	};
}

SWYM.CollectEtcRec = function(parsetree, resultSoFar)
{
	if( !parsetree )
		return;
		
	var idxLimit = parsetree.children.length;
	if( idxLimit > 1 && parsetree.op !== undefined && parsetree.op.etc !== undefined )
	{
		for( var Idx = 1; Idx < idxLimit; Idx++ )
		{			
			resultSoFar.finalExample.push( parsetree.children[Idx] );
		}
		idxLimit = 1;
	}
	
	for( var Idx = 0; Idx < idxLimit; Idx++ )
	{
		var childNode = parsetree.children[Idx];
		if( (childNode.type === "node" && childNode.op.text === resultSoFar.op.text) ||
			(resultSoFar.op.type === "fnnode" && childNode.name === resultSoFar.op.name))
		{
			if( Idx !== resultSoFar.recursiveIdx && resultSoFar.recursiveIdx !== undefined )
			{
				SWYM.LogError(childNode, "Inconsistent recursion in etc!");
			}
			
			resultSoFar.recursiveIdx = Idx;
			SWYM.CollectEtcRec(childNode, resultSoFar);
		}
		else if( Idx === resultSoFar.recursiveIdx && resultSoFar.recursiveIdx !== undefined )
		{
			if( resultSoFar.baseCase === undefined )
			{
				resultSoFar.baseCase = childNode;
			}
			else
			{
				SWYM.LogError(childNode.pos, "Fsckup: Too many base cases for etc sequence!?");
			}
		}
		else
		{
			if( resultSoFar.exampleChildren[Idx] === undefined )
			{
				resultSoFar.exampleChildren[Idx] = [];
			}
			resultSoFar.exampleChildren[Idx].push(parsetree.children[Idx]);
		}
	}

	if((parsetree.op && parsetree.op.etc) || (parsetree.type === "fnnode" && parsetree.etc))
	{
		if( resultSoFar.afterEtc )
			SWYM.LogError(parsetree.pos, "Cannot have more than one etc per sequence!");

		if( parsetree.op && parsetree.op.etc === "etc" )
			resultSoFar.stopCollecting = true;
		else if( parsetree.type === "fnnode" && parsetree.etc === "etc" )
			resultSoFar.stopCollecting = true;

		resultSoFar.afterEtc = true;
	}
}

SWYM.FindAndProcessEtcRec = function(parsetree, etcId)
{
	if( !parsetree )
		return;

	if( parsetree.type === "node" || parsetree.type === "fnnode" )
	{
		if( parsetree.etc )
			return parsetree;
		else if(parsetree.op && parsetree.op.etc)
			return parsetree.op; //found an etc node! Notify the caller.

		var etcOp;
		for( var Idx = 0; Idx < parsetree.children.length; Idx++ )
		{
			etcOp = SWYM.FindAndProcessEtcRec(parsetree.children[Idx], etcId);
			if ( etcOp )
			{
				if( parsetree.op && etcOp.text === parsetree.op.text )
				{
					// this continues an etc node! Notify the caller.
					return etcOp;
				}
				else if ( parsetree.type === "fnnode" && etcOp.name === parsetree.name)
				{
					// this continues an etc function! Notify the caller.
					return etcOp;
				}
				else
				{
					// we have found the limit of this whole etc - now process it.
					parsetree.children[Idx] = SWYM.CollectEtc(parsetree.children[Idx], etcOp, etcId);
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
	var etcOp = SWYM.FindAndProcessEtcRec(parsetree, etcId);
	if( etcOp )
		return SWYM.CollectEtc(parsetree, etcOp, etcId);
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
		if( resultAtIdx + 0.0000000001 < sequence[Idx] || resultAtIdx - 0.0000000001 > sequence[Idx] )
			return false;
	}
	
	return true;
}

SWYM.EtcCreateExpandingGenerator = function(expandingSequence)
{
	// simple rule: build a generator for the longest sequence,
	// and then check that all the others match the stem/tail of it.
	// This handles sequences like [[1],[1,2],[1,2,3],etc]
	// and [[1],[2,1],[3,2,1],etc]
	
	var longestSequence = expandingSequence[expandingSequence.length-1];

	var forwardGenerator = SWYM.EtcCreateGenerator(longestSequence);
	expandingSequence.type = longestSequence.type;
	
	longestSequence.reverse();
	var reverseGenerator = SWYM.EtcCreateGenerator(longestSequence);
	longestSequence.reverse();

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
	var flattenedGenerator = SWYM.EtcCreateGenerator(flattened);
	
	if( flattenedGenerator !== undefined )
	{
		return function(expIdx, subIdx)
		{
			return flattenedGenerator( (expIdx*expIdx + expIdx)/2 + subIdx ) ;
		}
	}
	
	SWYM.LogError(0, "etc - can't find a rule for sequence ["+expandingSequence+"].");
	return undefined;
}

SWYM.EtcCreateGenerator = function(sequence)
{
	if( typeof(sequence[0]) === "string" )
	{
		// string sequences
		return SWYM.EtcCreateStringGenerator(sequence)
	}
	else if( typeof(sequence[0]) === "number" )
	{
		// number sequences
		return SWYM.EtcCreateNumberGenerator(sequence)
	}
}

SWYM.EtcCreateStringGenerator = function(sequence)
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
	
	SWYM.LogError(0, "etc - can't find a rule for sequence ["+sequence+"].");
   	return undefined;
}

SWYM.EtcCreateNumberGenerator = function(sequence)
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

	if( sequence.length >= 4 && SWYM.EtcTryNumberGenerator(sequence, cumgeometric))
	{
		if( factor > 0 )
		{
			if( firstDiff > 0 )
				sequence.direction = "ascending";
			else if ( firstDiff < 0 )
				sequence.direction = "descending";
		}
			
		sequence.type = (base%1==0 && firstDiff%1==0 && factor%1==0)? SWYM.IntType: SWYM.NumberType;

		return cumgeometric;
	}
	else
	{
		term4s["cumulative geometric"] = cumgeometric(3);
	}

	// try the factorial sequence, e.g. 1, 2, 6, 24, etc
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

	if( sequence.length >= 4 && SWYM.EtcTryNumberGenerator(sequence, factorialSeq))
	{
		sequence.type = SWYM.IntType;
		return factorialSeq;
	}
	else
	{
		term4s["factorial"] = factorialSeq(3);
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
   	
	if( sequence.length == 3 )
	{
		var contList = "";
		for( var title in term4s )
		{
			if(contList !== "")
				contList += ", ";
			
			contList += term4s[title]+" ("+title+")";
		}

		SWYM.LogError(0, "etc - ambiguous sequence ["+sequence+"]. Please provide a 4th term. Known ways to continue this sequence: "+contList);
	}
	else
	{
		SWYM.LogError(0, "etc - can't find a rule for sequence ["+sequence+"].");
	}
   	return undefined;
}

SWYM.ResolveEtcSequence = function(sequence, index)
{
	if( sequence.length > index )
		return sequence[index];
	
	if (!sequence.generator)
	{
		var genOffset = 0;
		for( var Idx = 0; Idx < sequence.length; Idx++ )
		{
			if ( sequence[Idx] !== undefined )
			{
				genOffset = Idx;
				break;
			}
		}
		sequence.generator = SWYM.EtcCreateGenerator(sequence.slice(genOffset, sequence.length));
		if ( !sequence.generator )
		{
			SWYM.LogError(0, "Unable to find a rule that generates sequence "+sequence);
			return undefined;
		}
		
		if( genOffset > 0 )
		{
			var oldGen = sequence.generator;
			sequence.generator = function(index) { return oldGen(index-genOffset); };
		}
	}

	var result = sequence.generator(index);
	var outOfBounds = false;

	// check for the end of the sequence
	if( result !== undefined && sequence.maxIndex === undefined && sequence.finalExample !== undefined )
	{
		if( result === sequence.finalExample )
		{
			if( sequence.excludeFinalExample )
			{
				sequence.maxIndex = index-1;
				outOfBounds = true;
			}
			else
			{
				sequence.maxIndex = index;
			}
		}
		else if ( (sequence.direction === "ascending" && result > sequence.finalExample) ||
				(sequence.direction === "descending" && result < sequence.finalExample))
		{
			outOfBounds = true;
		}
	}

	if( outOfBounds || (sequence.maxIndex !== undefined && index > sequence.maxIndex) )
	{
		if ( SWYM.scope["#outOfBoundsFlag"].value === false )
			SWYM.scope["#outOfBoundsFlag"].value = true;
		
		return null;
	}

	return result;
}

SWYM.onLoad("swymEtc.js");