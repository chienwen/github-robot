const config = require('./lib/config');
const TEAM_ID = config('CLICKUP_TEAM_ID');
const AUTH_TOKEN = config('CLICKUP_TOKEN');
const GITHUB_REPO = config('CLICKUP_GITHUB_REPO');
const API_BASE = 'https://api.clickup.com';

const axios = require('axios');
axios.defaults.headers.common['Authorization'] = AUTH_TOKEN;

const { GitHubOperator } = require('./lib/github');
const github = new GitHubOperator(null, GITHUB_REPO);

async function populateListsTasks(listObjects, spaceName) {
  for (let i = 0; i < listObjects.length; i++) {
    let isLastPage = true;
    let page = -1;
    listObjects[i].tasks = [];
    do {
      page += 1;
      console.error("\t\tread list", i, "page", page, spaceName, listObjects[i].name);
      const res = await axios.get(`${API_BASE}/api/v2/list/${listObjects[i].id}/task`, {
        params: {
          include_markdown_description: true,
          include_closed: true,
          subtasks: true,
          page
        }
      })
      const resData = res.data;
      listObjects[i].tasks = listObjects[i].tasks.concat(resData.tasks);
      isLastPage = resData.last_page;
    } while (!isLastPage);
    // clean up task
    listObjects[i].tasks.forEach(task => {
      delete task.creator;
      delete task.assignees;
      delete task.watchers;
      delete task.sharing;
      delete task.folder;
      delete task.space;
      delete task.project;
      delete task.permission_level;
      delete task.list;
      delete task.team_id;
    });
    delete listObjects[i].folder;
    delete listObjects[i].space;
    delete listObjects[i].permission_level;
  }
}

function backupSpacePromise(space) {
  return new Promise((resolve, reject) => {
    console.error("Working on space", space.id, space.name);
    Promise.all([
      axios.get(`${API_BASE}/api/v2/space/${space.id}/folder`),
      axios.get(`${API_BASE}/api/v2/space/${space.id}/list`)
    ]).then(ress => {
      let listObjects = [...ress[1].data.lists];
      ress[0].data.folders.forEach(folder => {
        listObjects = listObjects.concat(folder.lists);
      });
      const folders = [{ id: '_DEFAULT', lists: ress[1].data.lists }, ...ress[0].data.folders];
      console.error("\tpopulateListsTasks", space.id, space.name);
      populateListsTasks(listObjects, space.name).then(() => {
        resolve({ space, folders });
      });
    });
  });
}

async function publishGithub(results) {
	console.error("Pushing github", results.length, "files");
	for (let i = 0; i < results.length; i++) {
		const { space, folders } = results[i];
		const jsonDoc = JSON.stringify({ space, folders }, null, 4);
		const path = `space_${space.name}.json`;
		const data = await github.read(path);
		if (data && data.content === jsonDoc) {
			console.error(304, "NO_CHANGE", path);
		} else {
			const ghRes = await github.write(path, data ? data.sha : undefined, jsonDoc);
			console.error(ghRes.status, ghRes.data.commit.html_url);
		}
		//const ghRes = await github.writeAnyway(path, jsonDoc);
	}
}

axios.get(`${API_BASE}/api/v2/team/${TEAM_ID}/space`, {
  params: {
    archived: 'false'
  }
}).then(res => {
  const spaces = res.data.spaces;
  Promise.all(spaces.map(backupSpacePromise)).then(results => {
	publishGithub(results);
    //console.log(JSON.stringify(results));
  });
}).catch(e => {
  console.error("Error to call clickup API", e);
})
