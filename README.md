# git-watcher

A simple utility to synchronize git repositories for your organizations.

## Usage
0. Generate a new OAuth personal access token: https://github.com/settings/tokens/new, with the following permission:
    * `repo`
    * `public_repo`
    * `read:org`

0. Paste the following, including the token you just generated into `local.json` in the repository root:

    ```json
    {
        "githubToken": "YOUR_TOKEN"
    }
    ```

0. Run `npm install`

0. Run `node git-watcher.js`

## Notes

The utility currently performs a blind `git pull` of each repository. This may cause conflicts with changes made in the directories.
