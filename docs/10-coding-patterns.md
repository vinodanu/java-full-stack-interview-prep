[Repository home](../README.md) · [Previous chapter](09-system-design.md) · [Next chapter](11-behavioral-and-narrative.md)

## 10. Coding patterns

Put these methods inside a practice class with `import java.util.*;`. State input assumptions before coding and explain the invariant while coding.

### 1. Sliding window

**Recognize:** contiguous ranges, fixed-size sums, longest valid substring.

```java
static long maxWindowSum(int[] values, int k) {
    if (k <= 0 || k > values.length) {
        throw new IllegalArgumentException("Invalid window size");
    }

    long sum = 0;
    for (int i = 0; i < k; i++) {
        sum += values[i];
    }

    long best = sum;
    for (int right = k; right < values.length; right++) {
        sum += values[right];
        sum -= values[right - k];
        best = Math.max(best, sum);
    }
    return best;
}
```

**Complexity:** O(n) time, O(1) space.  
**Practice:** Maximum Average Subarray I; Longest Substring Without Repeating Characters.  
**Q: When does shrinking a sum-based window fail?** With arbitrary negative values, the monotonic property used by many variable-window algorithms disappears.

### 2. Two pointers

**Recognize:** sorted arrays, pair sums, in-place compaction.

```java
static int[] pairSum(int[] sorted, long target) {
    int left = 0;
    int right = sorted.length - 1;

    while (left < right) {
        long sum = (long) sorted[left] + sorted[right];
        if (sum == target) {
            return new int[] { left, right };
        }
        if (sum < target) {
            left++;
        } else {
            right--;
        }
    }
    return new int[] { -1, -1 };
}
```

**Complexity:** O(n) time, O(1) extra space.  
**Practice:** Two Sum II; Container With Most Water.  
**Q: Why is pointer movement correct?** Sorted order lets you eliminate impossible candidates; Container With Most Water uses a different height-based proof.

### 3. Fast/slow pointers

**Recognize:** linked-list cycle, middle node, repeated-state cycles.

```java
static class Node {
    int value;
    Node next;

    Node(int value) {
        this.value = value;
    }
}

static boolean hasCycle(Node head) {
    Node slow = head;
    Node fast = head;

    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) {
            return true;
        }
    }
    return false;
}
```

**Complexity:** O(n) time, O(1) space.  
**Practice:** Linked List Cycle; Linked List Cycle II.  
**Q: Why do they meet?** Inside a cycle, the relative distance changes modulo the cycle length by one per iteration.

### 4. BFS/DFS

**Recognize:** connectivity, traversal, unweighted shortest paths.

```java
static int[] bfsDistances(List<List<Integer>> graph, int start) {
    int[] distance = new int[graph.size()];
    Arrays.fill(distance, -1);

    Queue<Integer> queue = new ArrayDeque<>();
    queue.add(start);
    distance[start] = 0;

    while (!queue.isEmpty()) {
        int node = queue.remove();
        for (int next : graph.get(node)) {
            if (distance[next] == -1) {
                distance[next] = distance[node] + 1;
                queue.add(next); // Mark visited when enqueuing.
            }
        }
    }
    return distance;
}

static void dfs(
        List<List<Integer>> graph, int node, boolean[] visited) {
    visited[node] = true;
    for (int next : graph.get(node)) {
        if (!visited[next]) {
            dfs(graph, next, visited);
        }
    }
}
```

**Complexity:** O(V+E) time, O(V) auxiliary space.  
**Practice:** Number of Islands; Rotting Oranges.  
**Q: When is BFS the shortest-path algorithm?** When edges have equal weight; weighted graphs need another approach. Deep recursive DFS can overflow the stack.

### 5. Topological sort

**Recognize:** prerequisite ordering and directed dependency cycles.

```java
static List<Integer> topologicalOrder(
        List<List<Integer>> graph) {

    int[] indegree = new int[graph.size()];
    for (List<Integer> edges : graph) {
        for (int next : edges) {
            indegree[next]++;
        }
    }

    Queue<Integer> ready = new ArrayDeque<>();
    for (int node = 0; node < graph.size(); node++) {
        if (indegree[node] == 0) {
            ready.add(node);
        }
    }

    List<Integer> order = new ArrayList<>();
    while (!ready.isEmpty()) {
        int node = ready.remove();
        order.add(node);
        for (int next : graph.get(node)) {
            if (--indegree[next] == 0) {
                ready.add(next);
            }
        }
    }

    if (order.size() != graph.size()) {
        throw new IllegalArgumentException("Directed cycle");
    }
    return order;
}
```

**Complexity:** O(V+E) time, O(V) extra space.  
**Practice:** Course Schedule; Course Schedule II.  
**Q: How is a cycle detected?** A cycle prevents all vertices from reaching zero indegree.

### 6. Merge intervals

**Recognize:** overlapping schedules and ranges.

```java
static List<int[]> mergeIntervals(int[][] intervals) {
    Arrays.sort(intervals,
            Comparator.comparingInt(interval -> interval[0]));

    List<int[]> merged = new ArrayList<>();
    for (int[] interval : intervals) {
        if (merged.isEmpty()
                || merged.get(merged.size() - 1)[1] < interval[0]) {
            merged.add(interval.clone());
        } else {
            int[] last = merged.get(merged.size() - 1);
            last[1] = Math.max(last[1], interval[1]);
        }
    }
    return merged;
}
```

**Complexity:** O(n log n) time, O(n) output space.  
**Practice:** Merge Intervals; Insert Interval.  
**Q: Do touching intervals overlap?** This template merges touching closed intervals. For half-open intervals, change the boundary rule deliberately.

### 7. Dynamic programming basics

**Recognize:** repeated subproblems with an optimal-value recurrence.

```java
static int minimumCoins(int[] coins, int amount) {
    if (amount < 0) {
        throw new IllegalArgumentException("Negative amount");
    }
    for (int coin : coins) {
        if (coin <= 0) {
            throw new IllegalArgumentException("Positive coins required");
        }
    }

    int unreachable = amount + 1;
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, unreachable);
    dp[0] = 0;

    for (int value = 1; value <= amount; value++) {
        for (int coin : coins) {
            if (coin <= value && dp[value - coin] != unreachable) {
                dp[value] = Math.min(
                        dp[value], dp[value - coin] + 1);
            }
        }
    }
    return dp[amount] == unreachable ? -1 : dp[amount];
}
```

Assume interview-sized amounts that permit this array allocation.

**Complexity:** O(amount × number of coins) time, O(amount) space.  
**Practice:** Coin Change; House Robber.  
**Q: What should you explain before coding?** State, transition, base case, iteration order, and answer location.

### 8. Heaps

**Recognize:** top K, running priorities, merging sorted streams.

```java
static int kthLargest(int[] values, int k) {
    if (k <= 0 || k > values.length) {
        throw new IllegalArgumentException("Invalid k");
    }

    PriorityQueue<Integer> smallestOfTopK = new PriorityQueue<>();
    for (int value : values) {
        smallestOfTopK.add(value);
        if (smallestOfTopK.size() > k) {
            smallestOfTopK.remove();
        }
    }
    return smallestOfTopK.element();
}
```

**Complexity:** O(n log k) time, O(k) space.  
**Practice:** Kth Largest Element in an Array; Merge k Sorted Lists.  
**Q: Why a min-heap for largest K?** Its root is the weakest retained candidate, which is removed when the heap exceeds K.

**Coding-round checklist:** clarify → example → brute force → invariant → implementation → edge cases → complexity. Test empty inputs where valid, duplicates, overflow, negative values, and boundary conditions.

---
