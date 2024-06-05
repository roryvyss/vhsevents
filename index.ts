import { Client, ClientEvents, Intents } from "discord.js";
import { connect } from "mongoose";
import loadThings from "./settings/handler";
import { EVENTS } from "./settings/utils";
import * as dotenv from "dotenv";

dotenv.config();
const client = new Client({
	ws: {
		intents: Intents.ALL,
	},
	partials: ["CHANNEL", "MESSAGE", "REACTION"],
});

const main = async () => {
	await loadThings();
	await connect(process.env.MONGOURI!, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useCreateIndex: true,
		useFindAndModify: false,
	});

	EVENTS.forEach(({ name, run }) => {
		client.on(name as keyof ClientEvents, (...args) => {
			run(...args, client);
		});
	});

	client.login(process.env.TOKEN);
};

main();
