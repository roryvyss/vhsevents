import { Schema, model, Types } from "mongoose";

const afkSchema = new Schema({
	userId: String,
	message: {
		type: String,
		default: "AFK",
	},
	time: Number,
});

export interface IAfkSchema {
	_id?: Types.ObjectId;
	userId: string;
	message: string;
	time: number;
}

export const afkModel = model<IAfkSchema>("afkmodel", afkSchema);
