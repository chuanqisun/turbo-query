// Test script to reproduce the search by ID bug for multi-word work item types
// This demonstrates the actual issue using FlexSearch's "forward" tokenization

// First install FlexSearch if not already available
// npm install flexsearch

const FlexSearch = require('flexsearch');

function getShortIteration(iterationPath) {
  return iterationPath.split('\\').pop() || iterationPath;
}

// ORIGINAL implementation (with bug)
function getFuzzyTitleOriginal(item) {
  return `${item.state} ${item.id} ${item.workItemType} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${item.title} ${item.tags.join(" ")}`;
}

// FIXED implementation  
function getFuzzyTitleFixed(item) {
  return `${item.id} ${item.state} ${item.id} ${item.workItemType} ${item.id} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${item.title} ${item.tags.join(" ")}`;
}

// Test data - same as what users would encounter
const testItems = [
  {
    id: 12345,
    state: "Active",
    workItemType: "Bug",
    assignedTo: { displayName: "John Doe" },
    iterationPath: "Project\\Sprint 1",
    title: "Fix login issue",
    tags: ["critical"]
  },
  {
    id: 12346,
    state: "New", 
    workItemType: "Functional Testing",
    assignedTo: { displayName: "Jane Smith" },
    iterationPath: "Project\\Sprint 1",
    title: "Test user authentication flow",
    tags: ["e2e", "auth"]
  },
  {
    id: 12347,
    state: "Active",
    workItemType: "User Story",
    assignedTo: { displayName: "Bob Wilson" },
    iterationPath: "Project\\Sprint 2", 
    title: "Implement dashboard",
    tags: ["feature"]
  }
];

// Configure FlexSearch exactly like the actual app
const indexConfig = {
  preset: "default",
  charset: "latin:advanced", 
  tokenize: "forward",
  document: {
    id: "id",
    index: ["fuzzyTokens"]
  }
};

async function testSearchScenario(title, fuzzyTitleFunction) {
  console.log(`\n=== ${title} ===`);
  
  const index = new FlexSearch.Document(indexConfig);
  
  // Add all items to index
  testItems.forEach(item => {
    index.add(item.id, {
      id: item.id,
      fuzzyTokens: fuzzyTitleFunction(item)
    });
  });
  
  console.log("\nFuzzy titles generated:");
  testItems.forEach(item => {
    console.log(`  ${item.workItemType} ${item.id}: "${fuzzyTitleFunction(item)}"`);
  });
  
  // Test searching for each item by exact ID using the exact same method as the app
  console.log("\nSearching for items by exact ID (using searchAsync with fuzzyTokens index):");
  const results = {};
  
  for (const item of testItems) {
    try {
      const searchResults = await index.searchAsync(item.id.toString(), { index: "fuzzyTokens" });
      const found = searchResults.length > 0 && searchResults[0].result.includes(item.id);
      results[item.id] = found;
      
      console.log(`  Search "${item.id}" (${item.workItemType}): ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
      if (!found) {
        console.log(`    Search results: ${JSON.stringify(searchResults)}`);
      }
    } catch (error) {
      console.log(`  Search "${item.id}" (${item.workItemType}): ❌ ERROR - ${error.message}`);
      results[item.id] = false;
    }
  }
  
  // Test partial ID searches
  console.log("\nSearching for items by partial ID (using searchAsync with fuzzyTokens index):");
  const partialResults = {};
  
  for (const item of testItems) {
    try {
      const partial = item.id.toString().substring(0, 4); // "1234" from "12345"
      const searchResults = await index.searchAsync(partial, { index: "fuzzyTokens" });
      const found = searchResults.length > 0 && searchResults[0].result.some(id => id === item.id);
      partialResults[item.id] = found;
      
      console.log(`  Search "${partial}" (expecting ${item.workItemType} ${item.id}): ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
      if (!found && searchResults.length > 0) {
        console.log(`    Search results: ${JSON.stringify(searchResults)}`);
      }
    } catch (error) {
      console.log(`  Search "${partial}" (${item.workItemType}): ❌ ERROR - ${error.message}`);
      partialResults[item.id] = false;
    }
  }
  
  // Test with more complex scenarios - mix of different search terms
  console.log("\nTesting edge cases with more complex data:");
  
  // Add more challenging test cases with longer multi-word types and varying IDs
  const challengingItems = [
    {
      id: 54321,
      state: "Done",
      workItemType: "Test Case",
      assignedTo: { displayName: "Alice Johnson" },
      iterationPath: "Project\\Sprint 3",
      title: "Verify complex authentication scenarios",
      tags: ["regression", "security"]
    },
    {
      id: 98765,
      state: "In Progress",
      workItemType: "Code Review",
      assignedTo: { displayName: "Bob Smith" },
      iterationPath: "Project\\Sprint 3",
      title: "Review authentication module",
      tags: ["code-quality"]
    }
  ];
  
  // Add challenging items to index
  challengingItems.forEach(item => {
    index.add(item.id, {
      id: item.id,
      fuzzyTokens: fuzzyTitleFunction(item)
    });
  });
  
  console.log("\nAdded more challenging test cases:");
  challengingItems.forEach(item => {
    console.log(`  ${item.workItemType} ${item.id}: "${fuzzyTitleFunction(item)}"`);
  });
  
  // Test these challenging cases
  for (const item of challengingItems) {
    try {
      const searchResults = await index.searchAsync(item.id.toString(), { index: "fuzzyTokens" });
      const found = searchResults.length > 0 && searchResults[0].result.includes(item.id);
      results[item.id] = found;
      
      console.log(`  Search "${item.id}" (${item.workItemType}): ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
      if (!found) {
        console.log(`    Search results: ${JSON.stringify(searchResults)}`);
      }
    } catch (error) {
      console.log(`  Search "${item.id}" (${item.workItemType}): ❌ ERROR - ${error.message}`);
      results[item.id] = false;
    }
  }
  
  // Summary
  const exactFailures = Object.values(results).filter(r => !r).length;
  const partialFailures = Object.values(partialResults).filter(r => !r).length;
  
  console.log(`\nResults Summary:`);
  console.log(`  Exact ID searches: ${Object.keys(results).length - exactFailures}/${Object.keys(results).length} successful`);
  console.log(`  Partial ID searches: ${Object.keys(partialResults).length - partialFailures}/${Object.keys(partialResults).length} successful`);
  
  return {
    exactSearchSuccess: exactFailures === 0,
    partialSearchSuccess: partialFailures === 0,
    exactFailures,
    partialFailures
  };
}

async function main() {
  console.log("🔍 REPRODUCING SEARCH BY ID BUG");
  console.log("=====================================");
  console.log("This test demonstrates how FlexSearch's 'forward' tokenization");
  console.log("affects ID discoverability for different work item types.\n");
  
  try {
    // Test with original implementation (should show the bug)
    const originalResults = await testSearchScenario(
      "ORIGINAL IMPLEMENTATION (with bug)", 
      getFuzzyTitleOriginal
    );
    
    // Test with fixed implementation
    const fixedResults = await testSearchScenario(
      "FIXED IMPLEMENTATION", 
      getFuzzyTitleFixed
    );
    
    console.log("\n" + "=".repeat(50));
    console.log("🎯 CONCLUSION");
    console.log("=".repeat(50));
    
    if (originalResults.exactFailures > 0 || originalResults.partialFailures > 0) {
      console.log("❌ BUG CONFIRMED: Original implementation fails to find some items by ID");
      console.log(`   - ${originalResults.exactFailures} exact ID search failures`);
      console.log(`   - ${originalResults.partialFailures} partial ID search failures`);
      console.log("   - Multi-word work item types (like 'Functional Testing') are particularly affected");
      
      if (fixedResults.exactFailures === 0 && fixedResults.partialFailures === 0) {
        console.log("✅ FIX VERIFIED: Fixed implementation resolves all search failures");
        console.log("   - All items are now discoverable by exact and partial ID searches");
      } else {
        console.log("⚠️  Fix still has issues - needs further investigation");
      }
    } else {
      console.log("🤔 Unexpected: No search failures detected with original implementation");
      console.log("   - This might indicate the test setup doesn't match real conditions");
      console.log("   - Or the issue is more subtle than captured here");
    }
    
  } catch (error) {
    console.error("❌ Test failed with error:", error.message);
    console.log("\nTrying to install flexsearch...");
    
    const { spawn } = require('child_process');
    const npm = spawn('npm', ['install', 'flexsearch'], { stdio: 'inherit' });
    
    npm.on('close', (code) => {
      if (code === 0) {
        console.log("✅ FlexSearch installed. Please run the script again.");
      } else {
        console.log("❌ Failed to install FlexSearch. Please run: npm install flexsearch");
      }
    });
  }
}

main().catch(console.error);