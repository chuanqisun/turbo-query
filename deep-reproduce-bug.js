// Deep dive reproduction test - examining FlexSearch behavior in detail
// This test aims to understand the subtle differences that might cause the search by ID issue

const FlexSearch = require('flexsearch');

function getShortIteration(iterationPath) {
  return iterationPath.split('\\').pop() || iterationPath;
}

// ORIGINAL implementation (with potential bug)
function getFuzzyTitleOriginal(item) {
  return `${item.state} ${item.id} ${item.workItemType} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${item.title} ${item.tags.join(" ")}`;
}

// FIXED implementation  
function getFuzzyTitleFixed(item) {
  return `${item.id} ${item.state} ${item.id} ${item.workItemType} ${item.id} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${item.title} ${item.tags.join(" ")}`;
}

// Create a more realistic dataset that might expose the issue
const realisticTestItems = [
  // Single-word work item types (should work in both scenarios)
  {
    id: 12345,
    state: "Active",
    workItemType: "Bug",
    assignedTo: { displayName: "John Doe" },
    iterationPath: "MyProject\\Release 1\\Sprint 1",
    title: "Fix authentication timeout issue in login module",
    tags: ["critical", "security", "login"]
  },
  {
    id: 23456,
    state: "New",
    workItemType: "Task",
    assignedTo: { displayName: "Alice Johnson" },
    iterationPath: "MyProject\\Release 1\\Sprint 2",
    title: "Update user documentation for new features",
    tags: ["documentation", "user-guide"]
  },
  
  // Multi-word work item types (potential problem cases)
  {
    id: 34567,
    state: "In Progress",
    workItemType: "Functional Testing",
    assignedTo: { displayName: "Bob Wilson" },
    iterationPath: "MyProject\\Release 1\\Sprint 1",
    title: "Test complete user authentication workflow including password reset",
    tags: ["testing", "authentication", "e2e"]
  },
  {
    id: 45678,
    state: "Done",
    workItemType: "User Story",
    assignedTo: { displayName: "Carol Smith" },
    iterationPath: "MyProject\\Release 1\\Sprint 2",
    title: "As a user I want to reset my password securely",
    tags: ["user-story", "security", "password"]
  },
  {
    id: 56789,
    state: "New",
    workItemType: "Test Case",
    assignedTo: { displayName: "David Brown" },
    iterationPath: "MyProject\\Release 2\\Sprint 1",
    title: "Verify password complexity requirements are enforced",
    tags: ["test-case", "validation", "password"]
  },
  {
    id: 67890,
    state: "Active",
    workItemType: "Code Review",
    assignedTo: { displayName: "Eve Davis" },
    iterationPath: "MyProject\\Release 2\\Sprint 1",
    title: "Review authentication service implementation details",
    tags: ["code-review", "security", "implementation"]
  },
  
  // Edge cases with potentially problematic content
  {
    id: 78901,
    state: "Closed",
    workItemType: "Functional Testing",
    assignedTo: { displayName: "Frank Miller" },
    iterationPath: "MyProject\\Release 2\\Sprint 2",
    title: "Test all edge cases for user registration form validation including special characters",
    tags: ["edge-cases", "validation", "registration", "functional-testing"]
  },
  {
    id: 89012,
    state: "Resolved",
    workItemType: "User Story",
    assignedTo: { displayName: "Grace Lee" },
    iterationPath: "MyProject\\Release 3\\Sprint 1",
    title: "As an admin I want to manage user accounts efficiently through the admin panel",
    tags: ["admin", "user-management", "efficiency"]
  },
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

async function analyzeFuzzyTitleStructure(title, fuzzyTitleFunction) {
  console.log(`\n=== ${title} ===`);
  
  console.log("\nFuzzy title structure analysis:");
  realisticTestItems.forEach(item => {
    const fuzzyTitle = fuzzyTitleFunction(item);
    const words = fuzzyTitle.split(' ');
    const idPositions = [];
    words.forEach((word, index) => {
      if (word === item.id.toString()) {
        idPositions.push(index);
      }
    });
    
    console.log(`${item.workItemType} ${item.id}:`);
    console.log(`  Fuzzy title: "${fuzzyTitle}"`);
    console.log(`  Total words: ${words.length}, ID positions: [${idPositions.join(', ')}], ID appears ${idPositions.length} times`);
    console.log(`  First 5 words: [${words.slice(0, 5).join(', ')}]`);
  });
}

async function testSearchBehaviorDetailed(title, fuzzyTitleFunction) {
  console.log(`\n=== ${title} - Detailed Search Behavior ===`);
  
  const index = new FlexSearch.Document(indexConfig);
  
  // Add all items to index
  realisticTestItems.forEach(item => {
    index.add(item.id, {
      id: item.id,
      fuzzyTokens: fuzzyTitleFunction(item)
    });
  });
  
  console.log("\nTesting search with different query patterns:");
  
  const searchFailures = [];
  
  // Test exact ID searches
  for (const item of realisticTestItems) {
    try {
      const searchResults = await index.searchAsync(item.id.toString(), { 
        index: "fuzzyTokens",
        limit: 10  // Get more results to analyze ranking
      });
      
      const found = searchResults.length > 0 && searchResults[0].result.includes(item.id);
      const position = found ? searchResults[0].result.indexOf(item.id) : -1;
      
      console.log(`Search "${item.id}" (${item.workItemType}):`);
      console.log(`  Found: ${found ? '✅' : '❌'}`);
      console.log(`  Position in results: ${position}`);
      console.log(`  Total results: ${searchResults.length > 0 ? searchResults[0].result.length : 0}`);
      
      if (!found) {
        searchFailures.push({
          query: item.id.toString(),
          workItemType: item.workItemType,
          expected: item.id,
          results: searchResults
        });
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      searchFailures.push({
        query: item.id.toString(),
        workItemType: item.workItemType,
        expected: item.id,
        error: error.message
      });
    }
  }
  
  // Test partial ID searches
  console.log("\nTesting partial ID searches:");
  
  for (const item of realisticTestItems) {
    const partial = item.id.toString().substring(0, 3); // First 3 digits
    try {
      const searchResults = await index.searchAsync(partial, { 
        index: "fuzzyTokens",
        limit: 10
      });
      
      const found = searchResults.length > 0 && searchResults[0].result.includes(item.id);
      const position = found ? searchResults[0].result.indexOf(item.id) : -1;
      
      console.log(`Search "${partial}" (expecting ${item.workItemType} ${item.id}):`);
      console.log(`  Found: ${found ? '✅' : '❌'}`);
      console.log(`  Position in results: ${position}`);
      
      if (!found) {
        searchFailures.push({
          query: partial,
          workItemType: item.workItemType,
          expected: item.id,
          results: searchResults
        });
      }
    } catch (error) {
      console.log(`  ❌ ERROR: ${error.message}`);
      searchFailures.push({
        query: partial,
        workItemType: item.workItemType,
        expected: item.id,
        error: error.message
      });
    }
  }
  
  return searchFailures;
}

async function compareSearchRelevance() {
  console.log("\n" + "=".repeat(60));
  console.log("🔬 DEEP SEARCH RELEVANCE ANALYSIS");
  console.log("=".repeat(60));
  
  // Analyze fuzzy title structures
  await analyzeFuzzyTitleStructure("ORIGINAL IMPLEMENTATION - Fuzzy Title Analysis", getFuzzyTitleOriginal);
  await analyzeFuzzyTitleStructure("FIXED IMPLEMENTATION - Fuzzy Title Analysis", getFuzzyTitleFixed);
  
  // Test detailed search behavior
  const originalFailures = await testSearchBehaviorDetailed("ORIGINAL IMPLEMENTATION", getFuzzyTitleOriginal);
  const fixedFailures = await testSearchBehaviorDetailed("FIXED IMPLEMENTATION", getFuzzyTitleFixed);
  
  console.log("\n" + "=".repeat(50));
  console.log("📊 COMPARISON RESULTS");
  console.log("=".repeat(50));
  
  console.log(`Original implementation failures: ${originalFailures.length}`);
  console.log(`Fixed implementation failures: ${fixedFailures.length}`);
  
  if (originalFailures.length > 0) {
    console.log("\n❌ Search failures in ORIGINAL implementation:");
    originalFailures.forEach(failure => {
      console.log(`  - Query "${failure.query}" for ${failure.workItemType} ${failure.expected}`);
      if (failure.error) {
        console.log(`    Error: ${failure.error}`);
      } else {
        console.log(`    Results: ${failure.results.length > 0 ? failure.results[0].result.length : 0} items found`);
      }
    });
  }
  
  if (fixedFailures.length > 0) {
    console.log("\n❌ Search failures in FIXED implementation:");
    fixedFailures.forEach(failure => {
      console.log(`  - Query "${failure.query}" for ${failure.workItemType} ${failure.expected}`);
      if (failure.error) {
        console.log(`    Error: ${failure.error}`);
      } else {
        console.log(`    Results: ${failure.results.length > 0 ? failure.results[0].result.length : 0} items found`);
      }
    });
  }
  
  if (originalFailures.length === 0 && fixedFailures.length === 0) {
    console.log("🤔 No search failures detected in either implementation");
    console.log("   This suggests the issue might be:");
    console.log("   1. Dataset dependent - needs larger or more specific data");
    console.log("   2. Context dependent - related to real app state");
    console.log("   3. Configuration dependent - different FlexSearch settings");
    console.log("   4. Performance related - timing or async behavior");
  } else if (originalFailures.length > fixedFailures.length) {
    console.log("✅ FIX CONFIRMED: Original implementation has more search failures");
    console.log(`   Improvement: ${originalFailures.length - fixedFailures.length} fewer failures`);
  } else if (fixedFailures.length > originalFailures.length) {
    console.log("⚠️  REGRESSION: Fixed implementation has more search failures");
    console.log(`   Regression: ${fixedFailures.length - originalFailures.length} additional failures`);
  } else {
    console.log("➡️  SAME BEHAVIOR: Both implementations have the same number of failures");
  }
}

async function main() {
  try {
    await compareSearchRelevance();
  } catch (error) {
    console.error("❌ Test failed with error:", error);
    console.error(error.stack);
  }
}

main().catch(console.error);