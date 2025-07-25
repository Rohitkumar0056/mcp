export const toolSpecs = [
  // Context
  {
    name: "get_me",
    description: "Get authenticated user info.",
    category: "Context",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
      required: [],
    },
  },

  // Repos
  {
    name: "get_commit",
    description: "Get a specific commit.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        sha: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["owner", "repo", "sha"],
    },
  },
  {
    name: "list_branches",
    description: "List branches in a repository.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_tags",
    description: "List tags in a repository.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_commits",
    description: "List commits in a repository.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        author: { type: "string" },
        sha: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_file_contents",
    description: "Get file contents from a repository.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        ref: { type: "string" },
      },
      required: ["owner", "repo", "path"],
    },
  },
  {
    name: "create_branch",
    description: "Create a new branch.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string" },
        sha: { type: "string" },
      },
      required: ["owner", "repo", "branch", "sha"],
    },
  },
  {
    name: "create_or_update_file",
    description: "Create or update a file in a repository.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        content: { type: "string" },
        branch: { type: "string" },
        message: { type: "string" },
        sha: { type: "string" },
      },
      required: ["owner", "repo", "path", "content", "branch", "message"],
    },
  },
  {
    name: "create_repository",
    description: "Create a new GitHub repository.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        private: { type: "boolean" },
        org: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "fork_repository",
    description: "Fork a repository.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        org: { type: "string" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "push_files",
    description: "Push multiple files to a repository.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string" },
        files: { 
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              content: { type: "string" }
            },
            required: ["path", "content"]
          }
        },
        message: { type: "string" },
      },
      required: ["owner", "repo", "branch", "files", "message"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from a repository.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string" },
        branch: { type: "string" },
        message: { type: "string" },
        sha: { type: "string" },
      },
      required: ["owner", "repo", "path", "branch", "message", "sha"],
    },
  },
  {
    name: "search_code",
    description: "Search for code in repositories.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        owner: { type: "string" },
        repo: { type: "string" },
        sort: { type: "string" },
        order: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_repositories",
    description: "Search for repositories.",
    category: "Repos",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        sort: { type: "string" },
        order: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["query"],
    },
  },

  // Issues
  {
    name: "get_issue",
    description: "Get a specific issue.",
    category: "Issues",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        issue_number: { type: "number" },
      },
      required: ["owner", "repo", "issue_number"],
    },
  },
  {
    name: "list_issues",
    description: "List issues in a repository.",
    category: "Issues",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string" },
        labels: { type: "array", items: { type: "string" } },
        sort: { type: "string" },
        direction: { type: "string" },
        since: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "search_issues",
    description: "Search for issues.",
    category: "Issues",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        owner: { type: "string" },
        repo: { type: "string" },
        sort: { type: "string" },
        order: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_issue_comments",
    description: "Get comments for an issue.",
    category: "Issues",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        issue_number: { type: "number" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["owner", "repo", "issue_number"],
    },
  },
  {
    name: "create_issue",
    description: "Create a new issue.",
    category: "Issues",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
        assignees: { type: "array", items: { type: "string" } },
        labels: { type: "array", items: { type: "string" } },
      },
      required: ["owner", "repo", "title"],
    },
  },
  {
    name: "add_issue_comment",
    description: "Add a comment to an issue.",
    category: "Issues",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        issue_number: { type: "number" },
        body: { type: "string" },
      },
      required: ["owner", "repo", "issue_number", "body"],
    },
  },
  {
    name: "update_issue",
    description: "Update an existing issue.",
    category: "Issues",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        issue_number: { type: "number" },
        title: { type: "string" },
        body: { type: "string" },
        state: { type: "string" },
        assignees: { type: "array", items: { type: "string" } },
        labels: { type: "array", items: { type: "string" } },
      },
      required: ["owner", "repo", "issue_number"],
    },
  },
  {
    name: "assign_copilot_to_issue",
    description: "Assign Copilot to an issue.",
    category: "Issues",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        issueNumber: { type: "number" },
      },
      required: ["owner", "repo", "issueNumber"],
    },
  },

  // Pull Requests
  {
    name: "get_pull_request",
    description: "Get a specific pull request.",
    category: "Pull Requests",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pullNumber: { type: "number" },
      },
      required: ["owner", "repo", "pullNumber"],
    },
  },
  {
    name: "list_pull_requests",
    description: "List pull requests in a repository.",
    category: "Pull Requests",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string" },
        head: { type: "string" },
        base: { type: "string" },
        sort: { type: "string" },
        direction: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "create_pull_request",
    description: "Create a new pull request.",
    category: "Pull Requests",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        title: { type: "string" },
        head: { type: "string" },
        base: { type: "string" },
        body: { type: "string" },
        draft: { type: "boolean" },
        maintainer_can_modify: { type: "boolean" },
      },
      required: ["owner", "repo", "title", "head", "base"],
    },
  },
  {
    name: "merge_pull_request",
    description: "Merge a pull request.",
    category: "Pull Requests",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pullNumber: { type: "number" },
        commit_title: { type: "string" },
        commit_message: { type: "string" },
        merge_method: { type: "string" },
      },
      required: ["owner", "repo", "pullNumber"],
    },
  },
  {
    name: "update_pull_request",
    description: "Update an existing pull request.",
    category: "Pull Requests",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        pullNumber: { type: "number" },
        title: { type: "string" },
        body: { type: "string" },
        state: { type: "string" },
        base: { type: "string" },
        maintainer_can_modify: { type: "boolean" },
      },
      required: ["owner", "repo", "pullNumber"],
    },
  },

  // Actions
  {
    name: "list_workflows",
    description: "List workflows in a repository.",
    category: "Actions",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        page: { type: "number" },
        per_page: { type: "number" },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_workflow_runs",
    description: "List workflow runs.",
    category: "Actions",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        workflow_id: { type: "string" },
        branch: { type: "string" },
        event: { type: "string" },
        status: { type: "string" },
        page: { type: "number" },
        per_page: { type: "number" },
      },
      required: ["owner", "repo", "workflow_id"],
    },
  },
  {
    name: "get_workflow_run",
    description: "Get a specific workflow run.",
    category: "Actions",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        run_id: { type: "number" },
      },
      required: ["owner", "repo", "run_id"],
    },
  },
  {
    name: "get_workflow_run_logs",
    description: "Get workflow run logs.",
    category: "Actions",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        run_id: { type: "number" },
      },
      required: ["owner", "repo", "run_id"],
    },
  },
  {
    name: "list_workflow_jobs",
    description: "List workflow jobs.",
    category: "Actions",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        run_id: { type: "number" },
        page: { type: "number" },
        per_page: { type: "number" },
        filter: { type: "string" },
      },
      required: ["owner", "repo", "run_id"],
    },
  },
  {
    name: "get_job_logs",
    description: "Get job logs.",
    category: "Actions",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        run_id: { type: "number" },
        job_id: { type: "number" },
        failed_only: { type: "boolean" },
        return_content: { type: "boolean" },
      },
      required: ["owner", "repo", "run_id"],
    },
  },
  {
    name: "list_workflow_run_artifacts",
    description: "List workflow run artifacts.",
    category: "Actions",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        run_id: { type: "number" },
        page: { type: "number" },
        per_page: { type: "number" },
      },
      required: ["owner", "repo", "run_id"],
    },
  },

  // Code Security
  {
    name: "get_code_scanning_alert",
    description: "Get a code scanning alert.",
    category: "Code Security",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        alertNumber: { type: "number" },
      },
      required: ["owner", "repo", "alertNumber"],
    },
  },
  {
    name: "list_code_scanning_alerts",
    description: "List code scanning alerts.",
    category: "Code Security",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        ref: { type: "string" },
        severity: { type: "string" },
        state: { type: "string" },
      },
      required: ["owner", "repo"],
    },
  },

  // Secret Protection
  {
    name: "get_secret_scanning_alert",
    description: "Get a secret scanning alert.",
    category: "Secret Protection",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        alertNumber: { type: "number" },
      },
      required: ["owner", "repo", "alertNumber"],
    },
  },
  {
    name: "list_secret_scanning_alerts",
    description: "List secret scanning alerts.",
    category: "Secret Protection",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        state: { type: "string" },
        secret_type: { type: "string" },
        resolution: { type: "string" },
      },
      required: ["owner", "repo"],
    },
  },

  // Notifications
  {
    name: "list_notifications",
    description: "List notifications.",
    category: "Notifications",
    inputSchema: {
      type: "object",
      properties: {
        all: { type: "boolean" },
        participating: { type: "boolean" },
        since: { type: "string" },
        before: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "get_notification_details",
    description: "Get notification details.",
    category: "Notifications",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "dismiss_notification",
    description: "Dismiss a notification.",
    category: "Notifications",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "mark_all_notifications_read",
    description: "Mark all notifications as read.",
    category: "Notifications",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "manage_notification_subscription",
    description: "Manage notification subscription.",
    category: "Notifications",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        subscribed: { type: "boolean" },
        ignored: { type: "boolean" },
      },
      required: ["id", "subscribed", "ignored"],
    },
  },
  {
    name: "manage_repository_notification_subscription",
    description: "Manage repository notification subscription.",
    category: "Notifications",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        subscribed: { type: "boolean" },
        ignored: { type: "boolean" },
      },
      required: ["owner", "repo", "subscribed", "ignored"],
    },
  },

  // Users
  {
    name: "search_users",
    description: "Search for users.",
    category: "Users",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        sort: { type: "string" },
        order: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["query"],
    },
  },

  // Organizations
  {
    name: "search_orgs",
    description: "Search for organizations.",
    category: "Organizations",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        sort: { type: "string" },
        order: { type: "string" },
        page: { type: "number" },
        perPage: { type: "number" },
      },
      required: ["query"],
    },
  },

  // Custom tools
  {
    name: "github_token",
    description: "Enter your GitHub secret token.",
    category: "Custom",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string" },
      },
      required: ["token"],
    },
  },
  // {
  //   name: "tool_choices",
  //   description: "Choose any 4 tools from all available tools.",
  //   category: "Custom",
  //   inputSchema: {
  //     type: "object",
  //     properties: {
  //       tools: {
  //         type: "array",
  //         items: { type: "string" },
  //         description: "List of tool names you want to select",
  //       },
  //     },
  //     required: ["tools"],
  //   },
  // }
];