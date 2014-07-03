// Built-in dependencies
var exec = require("child_process").exec,
    fs = require("fs"),
    path = require("path");

// External dependencies
var async = require("async"),
    mkdirp = require("mkdirp"),
    request = require("request");

function loadConfig() {
    try {
        var filePath = path.join(__dirname, "local.json");
        var json = fs.readFileSync(filePath);
        var config = JSON.parse(json);

        verifyConfig(config);

        return config;
    } catch (err) {
        console.log("Failed to load configuration: " + filePath);
        throw err;
    }
}

function verifyConfig(config) {
    if (!config.githubToken) {
        throw "githubToken must be specified in config."
    }
}

var config = loadConfig();

var queue = async.queue(function(task, callback) {
    initRepo(task, callback);
}, 8);

request = request.defaults({
    json: true,
    headers: {
        "User-Agent": "git-watcher"
    }
});

request("https://api.github.com/user/orgs?access_token=" + config.githubToken, function(error, response, body) {
    if (error) {
        console.log("ERROR", error);
        return;
    }

    var orgs = [];

    if (!error && response.statusCode === 200) {
        for (var i = 0, org; org = body[i]; i++) {

            console.log("Pulling repos for org: " + org.login);

            pullRepos(org.login);
        }
    }
});

function pullRepos(orgName) {
    request("https://api.github.com/orgs/" + orgName + "/repos?type=private&per_page=100&access_token=" + config.githubToken, repoCallback);
}

function repoCallback(error, response, body) {
    var repos = [];

    if (!error && response.statusCode === 200) {
        for (var i = 0, repo; repo = body[i]; i++) {

            repos.push({
                name: repo.full_name,
                url: repo.clone_url
            });

        }
    }

    initRepos(repos);

    var nextPageMatches = /\<(.+)\>\s*;\s*rel\s*=\s*"next"/i.exec(response.headers.link);
    if (nextPageMatches) {
        request(nextPageMatches[1], repoCallback);
    }
}

function initRepos(repos) {
    queue.drain = function() {
        console.log("Finished processing repos.");
    };

    for (var i = 0, repo; repo = repos[i]; i++) {
        queue.push(repo);
    }
}

function initRepo(repo, callback) {
    fs.exists(repo.name, function(exists) {
        if (!exists) {
            mkdirp(repo.name, function(error) {
                if (error) {
                    console.log("ERROR", error);
                    return;
                }

                console.log("Created dir: " + repo.name);

                exec("git init", { cwd: repo.name }, function(error, stdout, stderr) {
                    if (error) {
                        console.log("ERROR", error);
                        return;
                    }

                    print(stdout, "\t");
                    print(stderr, "\t");

                    pullRepo(repo, callback);
                });
            });
        } else {
            pullRepo(repo, callback);
        }
    });
}

function pullRepo(repo, callback) {
    var url = rewriteGithubUrlWithOAuth(repo.url);

    exec("git pull " + url, { cwd: repo.name }, function(error, stdout, stderr) {
        if (error) {
            console.log("ERROR", error);

            callback();
            return;
        }

        print(stdout, "\t");
        print(stderr, "\t");

        console.log("Pulled " + repo.name);

        callback();
    });
}

function rewriteGithubUrlWithOAuth(url) {
    if (url) {
        url = url.replace("https://github.com", "https://" + config.githubToken + "@github.com");
    }

    return url;
}

function print(str, prefix) {
    prefix = prefix || "\t";
    str = prefix + str.trim().replace(/(\r?\n)/g, "$1" + prefix);

    console.log(str);
}
