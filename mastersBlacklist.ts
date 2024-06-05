import { Schema, model, Types } from "mongoose";

const mastersBlacklist = new Schema({
	uid: String,
});

export interface IMastersBlacklist {
	_id?: Types.ObjectId;
	uid: string;
}

export const mastersBlacklistModel = model<IMastersBlacklist>(
	"mastersBlacklist",
	mastersBlacklist
);
