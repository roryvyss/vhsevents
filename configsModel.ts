import { Schema, model } from "mongoose";

const _configModel = new Schema({
	guildId: String,
	xpOnline: {
		type: Number,
		default: 60,
	},
	xpMessage: {
		type: Number,
		default: 15,
	},
	prefix: {
		type: String,
		default: "!",
	},
	CurrencyLogo: {
		type: String,
		default: "<a:Star:632914440047820828>",
	},
	DailyCount: {
		type: Number,
		default: 10,
	},
	DailyTime: {
		type: Number,
		default: 86400,
	},
	ItemsOnPage: {
		type: Number,
		default: 5,
	},
	Messages: {
		type: Number,
		default: 0,
	},
	eventRate: {
		type: Number,
		default: 7,
	},
	varietyRate: {
		type: Number,
		default: 7,
	},
});

interface IConfigModel {
	guildId: string;
	xpOnline: number;
	xpMessage: number;
	prefix: string;
	CurrencyLogo: string;
	DailyCount: number;
	DailyTime: number;
	ItemsOnPage: number;
	Messages: number;
	eventRate: number;
	varietyRate: number;
}

export const configModel = model<IConfigModel>("configs", _configModel);
