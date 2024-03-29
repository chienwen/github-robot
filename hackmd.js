const config = require('./lib/config');
const AUTH_TOKEN = config('HACKMD_TOKEN');
const HACKMD_NOTE_REPO = config('HACKMD_GITHUB_REPO');

const API_BASE = 'https://api.hackmd.io';
const API_NOTE_PATH = '/v1/notes';
const AUTO_BACKUP_TAG = 'autoBackup';

const axios = require('axios');
axios.defaults.headers.common['Authorization'] = 'Bearer ' + AUTH_TOKEN;

const { GitHubOperator } = require('./lib/github');
const github = new GitHubOperator(null, HACKMD_NOTE_REPO);

axios.get(API_BASE + API_NOTE_PATH).then(res => {
	Promise.all(
		res.data
			.filter(file => file.tags.includes(AUTO_BACKUP_TAG))
			.map(
				file => axios
					.get(API_BASE + API_NOTE_PATH + '/' + file.id)
					.then(res => {
						const repoFilePath = file.title;
						return new Promise(resolve => {
							github.read(repoFilePath).then(data => {
								if (data && data.content === res.data.content) {
									resolve({status: 304, noChangeFile: repoFilePath});
								} else {
									github.write(repoFilePath, data ? data.sha : undefined, res.data.content).then(resolve);
								}
							});
						});
					})
					//.then(res => github.writeAnyway(file.title, res.data.content))
			)
	).then(results => {
		results.forEach(result => {
			if (result.noChangeFile) {
				console.log(result.status, 'NO_CHANGE', result.noChangeFile);
			} else {
				console.log(result.status, result.data.commit.html_url);
			}
		});
	});
});
