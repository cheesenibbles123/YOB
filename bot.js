const config = require("./config.json");
const Discord = require("discord.js");
const bot = new Discord.Client();
const fetch = require("node-fetch");
const mysql = require('mysql');
const fs = require('fs');
const btoa = require("btoa");

var messages = {
	"top10" : "689243938254880819",
	"all" : "689243941706399836",
	"serverStatus" : "689243938745221148"
}
var columnwidths = {
	"rank" : 4,
	"username" : 16,
	"wins" : 6,
	"losses" : 8,
	"score" : 10,
	"size" : 30
}

async function updateServerStats(){
	let delay = 9000;
	var interval = setInterval(function(){
			fetch('https://www.battlemetrics.com/servers/mordhau/6010351').then(res => res.text()).then(body => {
				let content = body.split("<div");
				let title = content[12].split("<h2>")[1];
				let playercount = content[16].split("dt>")[4].slice(4,content[16].split("dt>")[4].indexOf("/"));
				let rank = content[16].split("dt>")[2].slice(4,content[16].split("dt>")[2].indexOf("</dd"));
				let map = content[18].split("dt>")[2].slice(4,content[18].split("dt>")[2].indexOf("</dd"));
				let gamemode = content[18].split("dt>")[4].slice(4,content[18].split("dt>")[4].indexOf("</dd"));
				let newmsg = ("```diff\n"
							+`! ${title} !\n`
							+"\n"
							+`Rank: ${rank}\n`);
				if (parseInt(playercount)  >= 16){
					newmsg = newmsg+`-Players: ${playercount} / 20\n`;
				}else{
					newmsg = newmsg+`+Players: ${playercount} / 20\n`;
				}
				newmsg = newmsg +`Map: ${map}\n`
								+`GameMode: ${gamemode}\n`
								+"```";
				bot.channels.get("627544347596029982").fetchMessage(messages.serverStatus).then(msg => {msg.edit(newmsg);});
				bot.channels.get("627568878649606144").setName(`Players: ${playercount} / 20`);
			});
	},delay);
}

function getUserFromMention(mention) {
	// The id is the first and only match found by the RegEx.
	var matches = mention.match(/^<@!?(\d+)>$/);
	// If supplied variable was not a mention, matches will be null instead of an array.
	if (!matches) return;
	// However the first element in the matches array will be the entire mention, not just the ID,
	// so use index 1.
	var id = matches[1];
	return bot.users.get(id);
}

function calculateelo(message,memberid,win2,opponentid,opp2,nowinsp1,nowinsp2,mode){
	if (mode === "1v1"){
		var cone = mysql.createConnection({
			host: config.host,
			user: config.user,
			password: config.password,
			database: config.database
		});
		cone.connect(err => {
			if(err) console.log(err);
			console.log("Connected to database!");	
		});
		cone.query(`SELECT * FROM elo WHERE (id = '${memberid}') OR (id = '${opponentid}')`, (err,rows) => {
			if(rows.length < 2){
				message.reply("A user is not yet registered, please use `;register @member` to register them.");
			}else{
				let P1=0;
				let P1score=0;
				let P2=0;
				let P2score=0;
				let frownum=0;
				let orownum=1;
				if (rows[0].id === memberid){
					P1score = parseInt(rows[0].score);
					P2score = parseInt(rows[1].score);
					frownum = 0;
					orownum = 1;
				}else
				if (rows[1].id === memberid){
					frownum = 1;
					orownum = 0;
					P1score = parseInt(rows[1].score);
					P2score = parseInt(rows[0].score);
				}
				P1 = (10 ** (P1score / 400));
				P2 = (10 ** (P2score / 400));
				let K = 35;
				let E1 = P1/(P1+P2);
				let E2 = P2/(P1+P2);

				let modvalue = Math.sqrt((nowinsp1-nowinsp2) / nowinsp1);			

				let R1 = P1score + K*(1-E1)*modvalue;
				let R2 = P2score + K*(0-E2)*modvalue;	

				message.channel.send("Calculation complete.");
				
				let losses = nowinsp2;
				if (losses < 0){
					losses = 0;
				}
				updateuserdata(rows[frownum],memberid,parseInt(nowinsp1),parseInt(losses),R1);
				message.channel.send(`Winner updated: ${bot.users.get(memberid).username}, ${P1score} => ${R1}`);

				losses = nowinsp1;
				if (losses < 0){
					losses = 0;
				}
				updateuserdata(rows[orownum],opponentid,parseInt(nowinsp2),parseInt(losses),R2);
				message.channel.send(`Opponent updated: ${bot.users.get(opponentid).username}, ${P2score} => ${R2}`);
			}
		});
		cone.end();
	}else if(mode === "2v2"){
		var con = mysql.createConnection({
			host: config.host,
			user: config.user,
			password: config.password,
			database: config.database
		});
		con.connect(err => {
			if(err) console.log(err);
			console.log("Connected to database!");	
		});
		con.query(`SELECT * FROM elo WHERE (id = '${memberid}') OR (id = '${win2}') OR (id = '${opponentid}') OR (id = '${opp2}')`, (err,rows) => {
			if(rows.length < 4){
				message.reply("A user is not yet registered, please use `;register @member` to register them.");
			}else{
				let P1=0;
				let T1score=0;
				let P2=0;
				let T2score=0;

				let wscore = 0;
				let w2score = 0;
				let oscore = 0;
				let o2score = 0;

				let wrownum=0;
				let w2rownum=0;
				let prownum=0;
				let o2rownum=0;

				for (i=0;i<rows.length;){
					if (rows[i].id === memberid){
						wscore = parseInt(rows[i].score);
						wrownum = i;
					}
					if(rows[i].id === win2){
						w2score = parseInt(rows[i].score);
						w2rownum = i;
					}
					if (rows[i].id === opponentid){
						oscore = parseInt(rows[i].score);
						orownum = i;
					}
					if(rows[i].id === opp2){
						o2score = parseInt(rows[i].score);
						o2rownum = i;
					}
					i++;
				}
				T1score = (wscore + w2score) / 2;
				T2score = (oscore + o2score) / 2;

				P1 = (10 ** (T1score / 400));
				P2 = (10 ** (T2score / 400));
				let K = 35;
				let E1 = P1/(P1+P2);
				let E2 = P2/(P1+P2);

				let modvalue = Math.sqrt((nowinsp1-nowinsp2) / nowinsp1);			

				let R1 = wscore + K*(1-E1)*modvalue;
				let R2 = w2score + K*(1-E1)*modvalue;
				let R3 = oscore + K*(0-E1)*modvalue;
				let R4 = o2score + K*(0-E2)*modvalue;	

				message.channel.send("Calculation complete.");
				
				let losses = nowinsp2;
				if (losses < 0){
					losses = 0;
				}

				updateuserdata(rows[wrownum],memberid,parseInt(nowinsp1),parseInt(losses),R1);
				message.channel.send(`Winner updated: ${bot.users.get(memberid).username}, ${wscore} => ${R1}`);
				updateuserdata(rows[w2rownum],win2,parseInt(nowinsp1),parseInt(losses),R2);
				message.channel.send(`Winner updated: ${bot.users.get(win2).username}, ${w2score} => ${R2}`);

				losses = nowinsp1;
				if (losses < 0){
					losses = 0;
				}

				updateuserdata(rows[orownum],opponentid,parseInt(nowinsp2),parseInt(losses),R3);
				message.channel.send(`Opponent updated: ${bot.users.get(opponentid).username}, ${oscore} => ${R3}`);
				updateuserdata(rows[o2rownum],opp2,parseInt(nowinsp2),parseInt(losses),R4);
				message.channel.send(`Opponent updated: ${bot.users.get(opp2).username}, ${o2score} => ${R4}`);
			}
		});
		con.end();
	}
}

async function manualupdate(){
	var con = mysql.createConnection({
		host: config.host,
		user: config.user,
		password: config.password,
		database: config.database
	});
	con.connect(err => {
		if(err) console.log(err);
		console.log("Connected to database!");	
	});
	con.query(`SELECT * FROM elo order by score desc`, (err,rows) =>{
		let length = 0;
		let top10 = "```---The King---\n";
		let finalmsg = "```diff\n"
						+"ELO board Top 30\n"
						+"Rank  Username            wins     losses    score\n";
		if (rows.length < 1){
			top10 = top10 + "empty";
			finalmsg = finalmsg + "empty";
		}else
		if (rows.length<columnwidths.size){
			length = rows.length;
		}else{
			length = columnwidths.size;
		}
		for (i=0;i<length-1;){
			if (rows.length > 0){
			if (i % 2 === 1){

				let rank = (i+1).toString();
					if (rank.length > columnwidths.rank){
						console.log("EXPAND SIZE");
					}else{
						let x = columnwidths.rank - rank.length;
						rank = rank + new Array(x + 1).join(' ');
					}

				let username = getUserName(rows,i);
				if (username.length > columnwidths.username){
					username = username.slice(0,columnwidths.username);
				}else{
					let x = columnwidths.username;
					x = x - username.length;
					username = username + new Array(x + 1).join(' ');
				}

				let wins = rows[i].wins.toString();
				if(wins.length > columnwidths.wins){
					wins = wins.slice(0,columnwidths.wins);
				}else{
					let x = columnwidths.wins;
					x = x - wins.length;
					wins = wins + new Array(x + 1).join(' ');
				}

				let losses = rows[i].losses.toString();
				if (losses.length > columnwidths.losses){
					losses.slice(0,columnwidths.losses);
				}else{
					let x = columnwidths.losses;
					x = x - losses.length;
					losses = losses + new Array(x + 1).join(' ');
				}

				let score = rows[i].score.toString();
				if (score.length > columnwidths.score){
					score.slice(0,columnwidths.score);
				}else{
					let x = columnwidths.score;
					x = x - score.length;
					score = score + new Array(x + 1).join(' ');
				}

				finalmsg = finalmsg + `+${rank} | ${username} | ${wins} | ${losses} | ${score}\n`;
			}else{
				let rank = (i+1).toString();
					if (rank.length > columnwidths.rank){
						console.log("EXPAND SIZE");
					}else{
						let x = columnwidths.rank - rank.length;
						rank = rank + new Array(x + 1).join(' ');
					}
				let username = getUserName(rows,i);
				if (username.length > columnwidths.username){
					username = username.slice(0,columnwidths.username);
				}else{
					let x = columnwidths.username;
					x = x - username.length;
					username = username + new Array(x + 1).join(' ');
				}
				let wins = rows[i].wins.toString();
				if(wins.length > columnwidths.wins){
					wins = wins.slice(0,columnwidths.wins);
				}else{
					let x = columnwidths.wins;
					x = x - wins.length;
					wins = wins + new Array(x + 1).join(' ');
				}
					let losses = rows[i].losses.toString();
				if (losses.length > columnwidths.username){
					losses.slice(0,columnwidths.losses);
				}else{
					let x = columnwidths.losses;
					x = x - losses.length;
					losses = losses + new Array(x + 1).join(' ');
				}
					let score = rows[i].score.toString();
				if (score.length > columnwidths.score){
					score.slice(0,columnwidths.score);
				}else{
					let x = columnwidths.score;
					x = x - score.length;
					score = score + new Array(x + 1).join(' ');
				}
				finalmsg = finalmsg + `-${rank} | ${username} | ${wins} | ${losses} | ${score}\n`;
			}
			if (i === 0){
				top10 = top10 + `${getUserName(rows,i)}\n\n---The Nobles---\n`;
			}else if (i < 3){
				top10 = top10 + `${getUserName(rows,i)}, Score: ${rows[i].score}\n`;
			}
			else if (i < 10){
				if (i === 3){
					top10 = top10 + `\n---The Royal Guard---\n${getUserName(rows,i)}, Score: ${rows[i].score}\n`;
				}else{
					top10 = top10 + `${getUserName(rows,i)}, Score: ${rows[i].score}\n`;
				}
			}
			i++;
		}
		//barrel of shame
		finalmsg = finalmsg+`+Barrel of Shame:\n${getUserName(rows,i)} Score: ${rows[rows.length-1].score}`;
		}
		bot.channels.get("630036273385570324").fetchMessage(messages.top10).then(msg =>{
			msg.edit(top10 + "```");
		});
		// bot.channels.get("630036273385570324").fetchMessage(messages.nobles).then(msg =>{
		// 	noble = noble + "```";
		// 	msg.edit(noble);
		// });
		// bot.channels.get("630036273385570324").fetchMessage(messages.rylguard).then(msg =>{
		// 	royalguard = royalguard + "```";
		// 	msg.edit(royalguard);
		// });
		bot.channels.get("630036273385570324").fetchMessage(messages.all).then(msg =>{
			msg.edit(finalmsg + "```");
		});
	});
	con.end();
}

function getUserName(rows,i){
	let usr;
	try{
		usr = bot.users.get(rows[i].id).username;
	}catch(e){
		usr = rows[i].id;
	}
	return usr;
}

function updateuserdata(rows,id,nowins,losses,score){
	var con = mysql.createConnection({
		host: config.host,
		user: config.user,
		password: config.password,
		database: config.database
	});
	con.connect(err => {
		if(err) console.log(err);
		console.log("Connected to database!");	
	});
	con.query(`UPDATE elo SET wins = ${parseInt(rows.wins) + nowins},losses = ${parseInt(rows.losses) + losses}, score = ${score} WHERE id = '${id}'`);
	con.end();
}

async function register(member,message){
	var conr = mysql.createConnection({
		host: config.host,
		user: config.user,
		password: config.password,
		database: config.database
	});
	conr.connect(err => {
		if(err) console.log(err);
		console.log("Connected to database!");	
	});
	conr.query(`SELECT * FROM elo WHERE id = '${member.id}'`, (err,rows) => {
		if (rows.length < 1){
			let username = btoa(member.user.username);
			if (!username){
				username = btoa("Cannot get username!");
			}
			let sql = `INSERT INTO elo (id,username,wins,losses,score) VALUES ('${member.id}',${username}, 0, 0, 1000.0)`;
			var cont = mysql.createConnection({
				host:"localhost",
				user:"root",
				password:"T16Q5lms",
				database:"discordbotstuff",
			});
			cont.connect(err => {
			if(err) console.log(err);
				console.log("Connected to database!");	
			});
			cont.query(sql);
			cont.end();
			message.reply("User has been registered successfully");
		}else{
			message.reply("User is already registered.");
		}
	});
	conr.end();
}

function getRandomInt(max) {
  return Math.floor(Math.random() * Math.floor(max));
};

function hotwheels(message){
	let file = fs.readFileSync("./datafile.json").toString();
	file = JSON.parse(file);
	let a = getRandomInt(file.hotwheels.length);
	message.channel.send(file.hotwheels[a]);
}

bot.on("ready", async () => {
	console.log("Startup complete");
	//channel = bot.channels.get("630036273385570324").fetchMessages();
	//channel.bulkdelete(10).catch(err => {console.log(err)});
	//bot.channels.get("627544347596029982").bulkDelete(10);
	//bot.channels.get("627544347596029982").fetchMessages(10).then(msgs => msgs.bulkDelete());

	//Server stats
	updateServerStats();
	setTimeout(function(){
		manualupdate();
	}, 5000);
});

bot.on("message", async message => {
	if (message.author.bot) return;
	if (message.channel.id === "629280641002897428"){
		let content = message.content;
		let d = new Date();
		let date = d.getDate()+"-"+d.getMonth()+"-"+d.getFullYear()
		message.guild.createChannel(`${message.author.username}-${date}`,"text",[
			{
				id : "597377384013889546",
				deny : ['VIEW_CHANNEL'],
			},
			{
				id : `${message.author.id}`,
				allow : ["VIEW_CHANNEL"],
			},
			{
				id : "597378827043471361",
				allow : ["VIEW_CHANNEL"],
			},
			{
				id : "623928309679652864",
				allow : ["VIEW_CHANNEL"],
			},
		]).then(channel => {
			channel.setParent("629280485952061460");
			channel.send("Query is: "+content+" - please wait for a member of <@&623928309679652864> to respond to your ticket.");
		});
		message.delete();  //support tickets
	}

	if (!message.content.startsWith(config.prefix)) return;
	let messagearray = message.content.split(" ");
	let command = messagearray[0].substring(1);
	command = command.toLowerCase();
	let args = messagearray.slice(1);
	let serverid = message.channel.guild.id;

	//PLAYER SUPPORT COMMANDS
	if (command === "escalate"){
		if (message.member.roles.has("597378827043471361") || message.member.roles.has("627548231273807881")){
			message.channel.permissionOverwrites.get("623928309679652864").delete();
		}
	}
	if (command === "archive"){
		if (message.member.roles.has("623928309679652864") || message.member.roles.has("627548231273807881")){
			await message.channel.permissionOverwrites.get("623928309679652864").delete();
			message.channel.setParent("638787934056873985");
		}
	}
	//ELO COMMANDS
	if (command === "updatelb"){
		if (message.member.roles.has("627548231273807881") || message.member.roles.has("597378827043471361")){  //if automatron or vet staff
			manualupdate();
		}else{
			message.reply("You cannot use that command.");
		}
	}
	if (command === "register"){
		if (message.member.roles.has("623928309679652864") || message.member.roles.has("627548231273807881")){ //if staff or automatron
			let member = message.mentions.users.first();
			if (!member) return message.reply("error, member not found");
			register(member,message);
		}else{
			message.channel.send("You do not have permissions to use this command.");
		}
	}
	if (command === "update"){
		if (message.member.roles.has("623928309679652864") || message.member.roles.has("597378827043471361") || message.member.roles.has("627548231273807881")){ 
			if (typeof args[0] === "undefined"){
				message.reply("Please enter a valid set.");
			}else
			if (args[0] === "1v1"){
				let member1 = getUserFromMention(args[1]);
				let member2 = getUserFromMention(args[2]);
				let nowins1 = 0;
				let nowins2 = 0;
				if (!(typeof args[3] === undefined) && !(typeof args[4] === undefined)){
					nowins1 = parseInt(args[3]);
					nowins2 = parseInt(args[4]);
				}else{
					message.reply("Please enter a valid number of wins");
				}
				if (nowins1 > nowins2){
					calculateelo(message,member1.id,"null",member2.id,"null",nowins1,nowins2,"1v1");
				}else{
					if (nowins2 > nowins1){
						calculateelo(message,member2.id,"null",member1.id,"null",nowins2,nowins1,"1v1");
					}
				}
			}
			else if(args[0] === "2v2"){
				let member1 = getUserFromMention(args[1]);
				let member2 = getUserFromMention(args[2]);
				let member3 = getUserFromMention(args[3]);
				let member4 = getUserFromMention(args[4]);
				let nowins1 = 0;
				let nowins2 = 0;
				if (!(typeof args[3] === undefined) && !(typeof args[4] === undefined)){
					nowins1 = parseInt(args[3]);
					nowins2 = parseInt(args[4]);
				}else{
					message.reply("Please enter a valid number of wins");
				}
				if (nowins1 > nowins2){
					calculateelo(message,member1.id,member2.id,member3.id,member4.id,nowins1,nowins2,"2v2");
				}else{
					if (nowins2 > nowins1){
						calculateelo(message,member3.id,member4.id,member1.id,member2.id,nowins2,nowins1,"2v2");
					}
				}
			}
		}else{
			message.channel.send("You cannot use this command.");
		}
	}
	//MESSAGE CLEARING
	if(command === 'clear'){
		if (message.member.roles.has("597378827043471361") || message.member.roles.has("627544677020598293")){
		var deleteCount = parseInt(args[0]);
		console.log(deleteCount);
		if (deleteCount === 0 || isNaN(deleteCount) || deleteCount < 0) {
			message.channel.send("Please enter a valid number.");
			return;
		}
		if (deleteCount > 100){
			let noruns = parseInt(deleteCount/100);
			let onesleft = deleteCount % 100;
			let runno = 0;
			while (noruns != runno){
				message.channel.bulkDelete(100).catch(error => message.reply("Couldn't delete messages because of:"+error+"."));
				runno++;
			}
			message.channel.bulkDelete(onesleft).catch(error => message.reply("Couldn't delete messages because of:"+error+"."));
			message.channel.send("deleted "+deleteCount+" messages.").then(message => {message.delete(3000)});
		}else{
			if (deleteCount <= 3){
				message.channel.send("Do it yourself you lazy bugger.");
				return;
			}else{
				message.channel.bulkDelete(deleteCount).catch(error => message.channel.send(`Counldn't delete messages because of: ${error}.`));
				message.delete();
				message.channel.send("Deleted "+deleteCount+" messages.").then(message => {message.delete(3000)});
			}
		}
		}else{
			message.reply("You cannot use this command.")
		}
	}
	//RESTARTING
	if (command === "restart"){
		if (message.author.id === "337541914687569920"){
			await message.channel.send("Restarting....");
			process.exit();
		}
	}
	//custom
	if (command === "hotwheels"){
		hotwheels(message);
	}
	// if (command === "updatedb"){
	// 	if (message.author.id === "337541914687569920"){
	// 	var conDB = mysql.createConnection({
	// 		host: config.host,
	//		user: config.user,
	//		password: config.password,
	//		database: config.database
	// 	});
	// 	conDB.connect(err => {
	// 		if(err) console.log(err);
	// 	});

	// 	conDB.query(`SELECT * FROM elo` , (err,rows) => {
	// 		for (i=0; i<rows.length-1;){
	// 			let username="";
	// 			try{
	// 				username = bot.users.get(rows[i].id).username;
	// 			}catch(e){
	// 				username = "UNABLE TO GET USERNAME";
	// 			}
	// 			var conDB2 = mysql.createConnection({
	// 				host: config.host,
	//				user: config.user,
	//				password: config.password,
	//				database: config.database,
	// 				charset : 'utf8mb4'
	// 			});
	// 			conDB2.connect(err => {
	// 				if(err) console.log(err);
	// 			});
	// 			username = btoa(username);
	// 			conDB2.query(`UPDATE elo SET username = '${username}' WHERE id = '${rows[i].id}'`);
	// 			i++;
	// 			conDB2.end()
	// 		}
	// 		message.reply("Username injection complete");
	// 	});
	// 	conDB.end();
	// 	}
	// }

	return;
});

bot.on("error", (error) => {
	console.log(error);
});

bot.login(config.token);
