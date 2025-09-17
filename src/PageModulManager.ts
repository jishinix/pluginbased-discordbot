import { DiscordBot } from "./DiscordBot";
import { ActionRowBuilder, BaseInteraction, ButtonBuilder, ButtonStyle, Guild, Interaction, Sticker } from 'discord.js';
import short from 'short-uuid';

export interface functionStorageObject {
    getDesc: Function,
    getDefBtn: Function,
    getMaxPages: Function,
    title: string
}

export class PageModulManager{
    discordBot: DiscordBot
    max: number;
    funcStorage: {[key: string]: functionStorageObject};


    constructor(discordBot: DiscordBot, max: number = 10){
        this.discordBot = discordBot;
        this.max = max;

        this.funcStorage = {};

        this.discordBot.botUtils.generateInteractionCb('buttons', 'pageModul_changePage', async (discordBot: DiscordBot, interaction: Interaction, options: string[])=>{
            if (!("reply" in interaction) || typeof interaction.reply !== "function") return
            const funcStorageId = options[0];
            const owner = options[1];
            if(!interaction.member || interaction.member.user.id !== owner){
                interaction.reply({embeds: [this.discordBot.defaultEmbeds.getNoAccessEmbed()], ephemeral: true});
                return;
            }
            const page = options[2];
            this.interactionUpdate(interaction, funcStorageId, Number(page))
        })
    }

    createFunctionStorage(getDesc: Function, getDefBtn: Function, getMaxPages: Function, title: string){
        const storageId = short.generate().replace(/-/g, '|');
        const obj = {
            getDesc: getDesc,
            getDefBtn: getDefBtn,
            getMaxPages: getMaxPages,
            title: title
        }

        this.funcStorage[storageId] = obj;

        return storageId;
    }

    async getMsg(funcId: string, owner: string, guild: Guild, page: number = 0, options: {}){
        let getDesc;
        let getDefBtn;
        let getMaxPages;
        let title;
        let storage = null;
        if(funcId){
            if(this.funcStorage[funcId]){
                storage = this.funcStorage[funcId];
                getDesc = storage.getDesc;
                getDefBtn = storage.getDefBtn;
                getMaxPages = storage.getMaxPages;
                title = storage.title;
            }
        }
        if (
            !storage ||
            !getDesc ||
            !getDefBtn ||
            !getMaxPages ||
            !title
        ) {
            return {embeds: [this.discordBot.defaultEmbeds.getAbgelaufenEmbed()]};
        }
        let desc = await getDesc(page, this.max, options);
        const defBtn = await getDefBtn(owner, options);
        const maxPages = await getMaxPages(this.max, options)

        const member = await guild.members.fetch(owner);
        if(!member) return {embeds: [this.discordBot.defaultEmbeds.getErrorEmbed()]};
        
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('none', [`Seite: ${(Number(page)+1)}/${maxPages+1}`,`Owner: ${this.discordBot.botUtils.getnick(member)}`]);
        embed.setTitle(title);
        if(desc) embed.setDescription(desc);
        
        
        let controllButtons = new ActionRowBuilder();
        controllButtons.addComponents(
            new ButtonBuilder()
                .setCustomId(`pageModul_changePage-${funcId}-${owner}-${Number(page)-1}`)
                .setStyle(ButtonStyle.Primary)
                .setLabel(`⏪`)
                .setDisabled(page == 0)
        );
        controllButtons.addComponents(
            new ButtonBuilder()
                .setCustomId(`pageModul_changePage-${funcId}-${owner}-${Number(page)+1}`)
                .setStyle(ButtonStyle.Primary)
                .setLabel(`⏩`)
                .setDisabled(page >= maxPages)
        );

        const components = [];
        if(defBtn) components.push(defBtn);
        components.push(controllButtons);
        return {embeds: [embed], components: components};
    }

    async interactionSend(interaction:BaseInteraction, funcStorageId:string, options = {}){
        if (!("reply" in interaction) || !interaction.member || !interaction.guild) return
        if('reply' in interaction && typeof interaction.reply === "function") interaction.reply(await this.getMsg(funcStorageId, interaction.member.user.id, interaction.guild, 0, options));
    }

    async interactionUpdate(interaction: BaseInteraction, funcStorageId: string, page = 0, options = {}){
        if (!("update" in interaction) || !interaction.member || !interaction.guild) return
        if('update' in interaction && typeof interaction.update === "function") interaction.update(await this.getMsg(funcStorageId, interaction.member.user.id, interaction.guild, page, options));
    }
}