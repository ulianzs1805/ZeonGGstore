import { Environment, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const cases = [
	{
		slug: "fable",
		name: "Fable Case",
		description: "Fable collection case",
		image: "/cases/fable-case.png",
		price: 100,
	},
	{
		slug: "chameleon",
		name: "Chameleon Case",
		description: "Chameleon collection case",
		image: "/cases/chameleon-case.png",
		price: 250,
	},
	{
		slug: "furious",
		name: "Furious Case",
		description: "Furious collection case",
		image: "/cases/furious-case.png",
		price: 500,
	},
	{
		slug: "empire",
		name: "Empire Case",
		description: "Empire collection case",
		image: "/cases/empire-case.png",
		price: 1000,
	},
] as const;

async function main() {
	const dev = await prisma.user.upsert({
		where: { email: "wystley6@gmail.com" },
		update: { role: Role.NPN1_DEV },
		create: {
			email: "wystley6@gmail.com",
			name: "Zeon Dev",
			role: Role.NPN1_DEV,
			balance: 10000,
		},
	});

	console.log(`User ready: ${dev.email}`);

	for (const item of cases) {
		const existing = await prisma.case.findUnique({ where: { slug: item.slug } });
		if (existing) {
			console.log(`Case already exists: ${item.name}`);
			continue;
		}

		await prisma.case.create({
			data: {
				...item,
				environment: Environment.SYSTEM,
				createdById: dev.id,
				drops: {
					create: [
						{
							name: "AK-47 Skin",
							rarity: "RARE",
							image: "/skins/default.png",
							price: item.price * 2,
							probability: 95,
							environment: Environment.SYSTEM,
						},
						{
							name: "Knife Skin",
							rarity: "LEGENDARY",
							image: "/skins/default.png",
							price: item.price * 10,
							probability: 5,
							environment: Environment.SYSTEM,
						},
					],
				},
			},
		});

		console.log(`Created case: ${item.name}`);
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
