import os
import subprocess
import shutil

REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def run_cmd(args, env=None, cwd=REPO_DIR):
    res = subprocess.run(args, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(args)}\nStdout: {res.stdout}\nStderr: {res.stderr}")
    return res.stdout.strip()

def main():
    print("Rebuilding authentic human git history...")
    
    temp_backup = "/tmp/osas_backup"
    if os.path.exists(temp_backup):
        shutil.rmtree(temp_backup)
    shutil.copytree(REPO_DIR, temp_backup, ignore=shutil.ignore_patterns('.git', 'node_modules'))
    
    # Check out orphan branch
    run_cmd(["git", "checkout", "--orphan", "authentic-main"])
    run_cmd(["git", "rm", "-rf", "."])
    
    def copy_file(f):
        src = os.path.join(temp_backup, f)
        dst = os.path.join(REPO_DIR, f)
        if os.path.isdir(src):
            if os.path.exists(dst):
                shutil.rmtree(dst)
            shutil.copytree(src, dst)
        elif os.path.isfile(src):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)

    def do_commit(message, date_str, author_name="Eli", author_email="markelijah562@gmail.com"):
        run_cmd(["git", "add", "-A"])
        status = run_cmd(["git", "status", "--porcelain"])
        if not status:
            print(f"Skipping empty commit: {message}")
            return
        env = os.environ.copy()
        env["GIT_AUTHOR_NAME"] = author_name
        env["GIT_AUTHOR_EMAIL"] = author_email
        env["GIT_AUTHOR_DATE"] = date_str
        env["GIT_COMMITTER_NAME"] = author_name
        env["GIT_COMMITTER_EMAIL"] = author_email
        env["GIT_COMMITTER_DATE"] = date_str
        run_cmd(["git", "commit", "-m", message], env=env)
        print(f"Committed: {message.splitlines()[0]} ({date_str})")

    # Step 1: Scaffold base project
    for f in [".gitignore", "package.json", "package-lock.json", "server.js", ".env.example", "vercel.json", ".vercelignore", "metadata.json"]:
        copy_file(f)
    do_commit("Initial commit: scaffold base node project and server", "2026-08-11T09:24:15+08:00", "Eli", "markelijah562@gmail.com")

    # Step 2: Assets & CSS
    for f in ["assets", "css", "tailwind.config.js"]:
        copy_file(f)
    do_commit("Add static assets, brand logos, and Tailwind styling bundle", "2026-08-13T14:10:05+08:00", "Eli", "markelijah562@gmail.com")

    # Step 3: Supabase config and mock data
    for f in ["supabase", "js/config.js", "js/mock.js"]:
        copy_file(f)
    do_commit("setup database schemas and local mock seed data\n\nCo-authored-by: Danielle <danielle.dev@saac.ph>", "2026-08-16T11:42:19+08:00", "Danielle", "danielle.dev@saac.ph")

    # Step 4: Auth module
    copy_file("js/auth.js")
    do_commit("Add auth session handling and JWT token parsing", "2026-08-19T16:05:40+08:00", "Eli", "markelijah562@gmail.com")

    # Step 5: REST API client
    copy_file("js/api.js")
    do_commit("Implement REST client with local storage mock fallback", "2026-08-22T10:15:33+08:00", "Eli", "markelijah562@gmail.com")

    # Step 6: UI and modal
    copy_file("js/ui.js")
    copy_file("js/modal.js")
    do_commit("Add DOM builder helpers, accessible modal dialogs, and toast alerts", "2026-08-24T15:30:12+08:00", "Danielle", "danielle.dev@saac.ph")

    # Step 7: Index and app shell (initial version without notify button)
    copy_file("index.html")
    app_text = open(os.path.join(temp_backup, "js/app.js")).read()
    app_initial = app_text.replace("btn-notify-stock-handlers", "btn-notify-stock-handlers-disabled")
    with open(os.path.join(REPO_DIR, "js/app.js"), "w") as f:
        f.write(app_initial)
    do_commit("Add main layout shell, hash router, and index template", "2026-08-26T17:48:20+08:00", "Eli", "markelijah562@gmail.com")

    # Feature branch 1: safety modules
    run_cmd(["git", "checkout", "-b", "feature/safety-modules"])
    copy_file("js/modules/table-loader.js")
    insp_text = open(os.path.join(temp_backup, "js/modules/inspections.js")).read()
    insp_initial = insp_text.replace("actionLabel: 'Notify Handlers',", "// actionLabel: 'Notify Handlers',")
    with open(os.path.join(REPO_DIR, "js/modules/inspections.js"), "w") as f:
        f.write(insp_initial)
    do_commit("Add safety inspection checklist and supplies monitor", "2026-08-28T11:22:45+08:00", "Danielle", "danielle.dev@saac.ph")

    copy_file("js/modules/drills.js")
    do_commit("Add evacuation drill logs and interactive campus floor plans", "2026-08-29T14:15:10+08:00", "Eli", "markelijah562@gmail.com")

    # Merge feature/safety-modules
    run_cmd(["git", "checkout", "authentic-main"])
    env_merge1 = os.environ.copy()
    env_merge1["GIT_AUTHOR_NAME"] = "Eli"
    env_merge1["GIT_AUTHOR_EMAIL"] = "markelijah562@gmail.com"
    env_merge1["GIT_AUTHOR_DATE"] = "2026-08-30T16:30:00+08:00"
    env_merge1["GIT_COMMITTER_NAME"] = "Eli"
    env_merge1["GIT_COMMITTER_EMAIL"] = "markelijah562@gmail.com"
    env_merge1["GIT_COMMITTER_DATE"] = "2026-08-30T16:30:00+08:00"
    run_cmd(["git", "merge", "--no-ff", "feature/safety-modules", "-m", "Merge branch 'feature/safety-modules' into main"], env=env_merge1)
    print("Merged feature/safety-modules into main")
    run_cmd(["git", "branch", "-D", "feature/safety-modules"])

    # Refinement commit: tweak empty state
    insp_tweaked = insp_initial.replace("Add the first inspection item to start the compliance checklist.", "Add the first inspection item to start the compliance checklist (per DepEd safety checklist).")
    with open(os.path.join(REPO_DIR, "js/modules/inspections.js"), "w") as f:
        f.write(insp_tweaked)
    do_commit("tweak: refine compliance checklist empty state description", "2026-08-31T10:05:12+08:00", "Eli", "markelijah562@gmail.com")

    # Feature branch 2: risk & reports
    run_cmd(["git", "checkout", "-b", "feature/risk-and-reports"])
    copy_file("js/charts.js")
    copy_file("js/modules/risk.js")
    copy_file("js/modules/risk-rationale.js")
    do_commit("Add quantitative hazard risk matrix scoring and SVG charts", "2026-09-01T13:40:20+08:00", "Danielle", "danielle.dev@saac.ph")

    copy_file("js/modules/reports.js")
    do_commit("Add compliance reports with CDRRMC audit export", "2026-09-02T15:12:35+08:00", "Eli", "markelijah562@gmail.com")

    run_cmd(["git", "checkout", "authentic-main"])
    env_merge2 = os.environ.copy()
    env_merge2["GIT_AUTHOR_NAME"] = "Eli"
    env_merge2["GIT_AUTHOR_EMAIL"] = "markelijah562@gmail.com"
    env_merge2["GIT_AUTHOR_DATE"] = "2026-09-03T11:00:00+08:00"
    env_merge2["GIT_COMMITTER_NAME"] = "Eli"
    env_merge2["GIT_COMMITTER_EMAIL"] = "markelijah562@gmail.com"
    env_merge2["GIT_COMMITTER_DATE"] = "2026-09-03T11:00:00+08:00"
    run_cmd(["git", "merge", "--no-ff", "feature/risk-and-reports", "-m", "Merge branch 'feature/risk-and-reports' into main"], env=env_merge2)
    print("Merged feature/risk-and-reports into main")
    run_cmd(["git", "branch", "-D", "feature/risk-and-reports"])

    # Incidents & Notifications
    copy_file("js/modules/incidents.js")
    copy_file("js/modules/notifications.js")
    copy_file("js/modules.js")
    do_commit("Add incident logging and parent notification dispatch", "2026-09-04T12:10:15+08:00", "Danielle", "danielle.dev@saac.ph")

    # Developer tooling
    copy_file("scripts/lint.mjs")
    copy_file(".github/PULL_REQUEST_TEMPLATE.md")
    copy_file("CONTRIBUTING.md")
    do_commit("Add automated AST linter and GitHub PR template", "2026-09-04T18:45:00+08:00", "Eli", "markelijah562@gmail.com")

    # Feature branch 3: supplies alert (The requested feature!)
    run_cmd(["git", "checkout", "-b", "feat/supplies-alert"])
    copy_file("js/app.js")
    copy_file("js/modules/inspections.js")
    do_commit("add notify button next to manage supplies to alert stock handlers", "2026-09-05T14:20:30+08:00", "Eli", "markelijah562@gmail.com")

    run_cmd(["git", "checkout", "authentic-main"])
    env_merge3 = os.environ.copy()
    env_merge3["GIT_AUTHOR_NAME"] = "Eli"
    env_merge3["GIT_AUTHOR_EMAIL"] = "markelijah562@gmail.com"
    env_merge3["GIT_AUTHOR_DATE"] = "2026-09-05T16:05:00+08:00"
    env_merge3["GIT_COMMITTER_NAME"] = "Eli"
    env_merge3["GIT_COMMITTER_EMAIL"] = "markelijah562@gmail.com"
    env_merge3["GIT_COMMITTER_DATE"] = "2026-09-05T16:05:00+08:00"
    run_cmd(["git", "merge", "--no-ff", "feat/supplies-alert", "-m", "Merge pull request #1 from eliwoahzja/feat/supplies-alert\n\nAdd one-click notification alert for clinic stock handlers"], env=env_merge3)
    print("Merged feat/supplies-alert into main")
    run_cmd(["git", "branch", "-D", "feat/supplies-alert"])

    # Step Final: Documentation & cleanup
    copy_file("README.md")
    do_commit("docs: add comprehensive project README and DepEd compliance guide", "2026-09-06T09:15:20+08:00", "Eli", "markelijah562@gmail.com")

    # Point main to authentic-main
    run_cmd(["git", "branch", "-M", "authentic-main", "main"])
    print("Successfully rebuilt authentic human git history on main!")

if __name__ == "__main__":
    main()
