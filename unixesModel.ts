import { Schema, model } from "mongoose";

const _unixesModel = new Schema({
	userId: String,
	role: String,
	time: Number,
	days: {
		type: Number,
		default: null,
	},
	ClubId: {
		type: String,
		default: null,
	},
	//Type 0: shop role
	//Type 1: self role
	//Type 2: gived role
	//Type 3: color role
	//Type 4: profile image
	Type: {
		type: Number,
		default: 0,
	},
});

interface IUnixesModel {
	userId: string;
	role: string;
	time: number;
	days: number;
	ClubId: string;
	Type: number;
}

export const unixesModel = model<IUnixesModel>("unixes", _unixesModel);
