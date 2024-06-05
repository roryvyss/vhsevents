import { Schema, model } from "mongoose";

const _userModel = new Schema({
	userId: String,
	birthday: { type: String, default: null },
	status: {
		type: String,
		default: null,
	},
	online: {
		type: Number,
		default: 0,
	},
	ClubId: {
		type: String,
		default: null,
	},
	clubDate: {
		type: Number,
		default: null,
	},
	isClubOwner: {
		type: Number,
		default: 0,
	},
	lvl: {
		type: Number,
		default: 0,
	},
	xp: {
		type: Number,
		default: 0,
	},
	MessageXp: {
		type: Number,
		default: 0,
	},
	ExperienceOnline: {
		type: Number,
		default: 0,
	},
	PacksOnline: {
		type: Number,
		default: 0,
	},
	CurrencyOnline: {
		type: Number,
		default: 0,
	},
	Currency: {
		type: Number,
		default: 0,
	},
	packs: {
		type: Number,
		default: 0,
	},
	lastDaily: {
		type: Number,
		default: 0,
	},
	msgCount: {
		type: Number,
		default: 0,
	},
	relationship: {
		type: String,
		default: null,
	},
	relationshipDate: {
		type: Number,
		default: null,
	},
	relationshipRoleID: {
		type: String,
		default: null,
	},
	cookies: {
		type: Number,
		default: 0,
	},
	picture: String,
	inventory: {
		type: Object,
		default: {
			role3d: {
				count: 0,
				emoji: "",
				name: "",
				text: "Личная роль на 3 дня",
			},
			role7d: {
				count: 0,
				emoji: "",
				name: "",
				text: "Личная роль на 7 дней",
			},
			role10d: {
				count: 0,
				emoji: "",
				name: "",
				text: "Личная роль на 10 дней",
			},
			role20d: {
				count: 0,
				emoji: "",
				name: "",
				text: "Личная роль на 20 дней",
			},
			role30d: {
				count: 0,
				emoji: "",
				name: "",
				text: "Личная роль на 30 дней",
			},
		},
	},
});

interface IUserModel {
    userId: string
    birthday: string
    status: string
    online: number
    ClubId: string
    clubDate: number
    isClubOwner: number
    lvl: number
    xp: number
    MessageXp: number
    ExperienceOnline: number
    PacksOnline: number
    CurrencyOnline: number
    Currency: number
    packs: number
    lastDaily: number
    msgCount: number
    relationship: string
    relationshipDate: number;
    relationshipRoleID: string
    cookies: number
    picture: string
    inventory: IUserInventory
}

interface IUserInventory {
	role3d: {
		count: number;
		emoji: string;
		name: string;
		text: string;
	};
	role7d: {
		count: number;
		emoji: string;
		name: string;
		text: string;
	};
	role10d: {
		count: number;
		emoji: string;
		name: string;
		text: string;
	};
	role20d: {
		count: number;
		emoji: string;
		name: string;
		text: string;
	};
	role30d: {
		count: number;
		emoji: string;
		name: string;
		text: string;
	};
}

export const userModel = model<IUserModel>("users", _userModel);
