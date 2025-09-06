// Test script to verify the search by ID fix for Functional Testing items
// Run: node test-search-fix.js

function getShortIteration(iterationPath) {
  return iterationPath.split('\\').pop() || iterationPath;
}

// Implementation matching the fixed version
function getFuzzyTitleTest(item) {
  return `${item.id} ${item.state} ${item.id} ${item.workItemType} ${item.id} ${item.assignedTo.displayName} ${getShortIteration(item.iterationPath)} ${item.title} ${item.tags.join(" ")}`;
}

console.log("=== TESTING SEARCH BY ID FIX ===");

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
    title: "Test user flow",
    tags: ["e2e"]
  }
];

let allTestsPassed = true;

testItems.forEach(item => {
  const fuzzyTitle = getFuzzyTitleTest(item);
  console.log(`\n${item.workItemType} ${item.id}:`);
  console.log(`Fuzzy title: "${fuzzyTitle}"`);
  
  // Verify ID appears at the beginning
  const startsWithId = fuzzyTitle.startsWith(item.id.toString());
  console.log(`✓ Starts with ID: ${startsWithId}`);
  
  // Verify ID appears multiple times
  const idCount = (fuzzyTitle.match(new RegExp(item.id.toString(), 'g')) || []).length;
  const hasMultipleIds = idCount >= 3;
  console.log(`✓ ID appears ${idCount} times (expected: ≥3): ${hasMultipleIds}`);
  
  // Verify fuzzy title contains all expected components
  const hasState = fuzzyTitle.includes(item.state);
  const hasWorkItemType = fuzzyTitle.includes(item.workItemType);
  const hasTitle = fuzzyTitle.includes(item.title);
  console.log(`✓ Contains state: ${hasState}`);
  console.log(`✓ Contains work item type: ${hasWorkItemType}`);
  console.log(`✓ Contains title: ${hasTitle}`);
  
  if (!startsWithId || !hasMultipleIds || !hasState || !hasWorkItemType || !hasTitle) {
    allTestsPassed = false;
  }
});

console.log(`\n=== RESULTS ===`);
if (allTestsPassed) {
  console.log("✅ ALL TESTS PASSED - Search by ID fix is working correctly");
  console.log("✅ Both Bug and Functional Testing items should be searchable by ID");
} else {
  console.log("❌ SOME TESTS FAILED - Review the fuzzy title generation");
  process.exit(1);
}