'use strict';

const Slack = require('slack-client');
const request = require('superagent');

const token = process.env.SLACK_TOKEN;

const wikiAPI = "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles="
const wikiURL = 'https://en.wikipedia.org/wiki/';

let slack = new Slack(token, true, true);

slack.on('open', () => {

  console.log(`Connected to ${slack.team.name} as ${slack.self.name}`);

  // Note how slack sends a list of all channels available
  let channels = getChannels(slack.channels);

  let channelNames = channels.map((channel) => {
    return channel.name;
  }).join(', ');

  console.log(`Currently in: ${channelNames}`)
});

slack.on('error', (err) => {
  console.log('Error:', err);
});

slack.on('message', (message) => {
  let user = slack.getUserByID(message.user);

  if (user && user.is_bot) {
    return;
  }

  let channel = slack.getChannelGroupOrDMByID(message.channel);

  if (message.text) {
    let msg = message.text.toLowerCase();

    if (/^wiki/g.test(msg)) {
      // for a wiki search capitalization matters, so let's grab the original request from message.text
      let args = message.text.split(' ').slice(1).join(' ');

      getWikiSummary(args, (err, result) => {
        if (err) {
          channel.send(`I\'m sorry, but something went wrong with your query.`);
          return;
        }

        let pageID = Object.keys(result.query.pages)[0];

        // -1 is wikipedia's 404
        if (parseInt(pageID, 10) === -1) {
          channel.send('That page does not exist yet, perhaps you\'d like to create it:');
          channel.send(wikiURL + args.replace(/ /g, '%20'));
          return;
        }

        let page = result.query.pages[pageID];
        let summary = page.extract;
        let title = page.title.replace(/ /g, '%20')

        if (/may refer to/g.test(summary)) {
          channel.send('Your search query may refer to multiple things, please be more specific or visit:');
          channel.send(wikiURL + title);
          return;
        }

        if (summary !== '') {
          channel.send(wikiURL + title);

          let paragraphs = summary.split('\n');

          paragraphs.forEach((paragraph) => {
            if (paragraph !== '') {
              channel.send(`> ${paragraph}`);
            }
          });
        } else {
          channel.send('I\'m sorry, I couldn\'t find anything on that subject. Try another one!');
        }
      });
    }
  }
});

// Start the login process
slack.login();

function getWikiSummary(term, cb) {

  // replace spaces with unicode
  let parameters = term.replace(/ /g, '%20');

  request
    .get(wikiAPI + parameters)
    .end((err, res) => {
      if (err) {
        cb(err);
        return;
      }

      cb(null, JSON.parse(res.text));
    });
}

// Returns an array of all the channels the bot resides in
function getChannels(allChannels) {
  let channels = [];

  // Loop over all channels
  for (let id in allChannels) {
    // Get an individual channel
    let channel = allChannels[id];

    // Is this user a member of the channel?
    if (channel.is_member) {
      // If so, push it to the array
      channels.push(channel);
    }
  }

  return channels;
}
