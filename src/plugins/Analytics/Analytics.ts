import { CommandInteraction, FetchMessagesOptions, Message, SlashCommandBuilder } from 'discord.js';
import {createCanvas} from 'canvas';
import moment from 'moment';
import fs from 'fs';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);
import short from 'short-uuid';
import { DiscordBot } from '../../DiscordBot.js';
import { CommandPlugin } from '../../CommandPlugin.js';
import { homePath } from '../../dirname.js';


const plugin = {
    id: 'customCanvasBackgroundColor',
    beforeDraw: (chart: any, args: any, options: any) => {
        const {ctx} = chart;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = options.color || '#000000';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
    }
};

Chart.register(plugin);


export default class Analytics extends CommandPlugin {
    discordBot: DiscordBot;
    allowedRoles: string[];
    allowedUsers: string[];
    startTrackingAt: string | null;
    colors: string[];

    constructor(discordBot: DiscordBot){
        super(discordBot.settings.plugins.Analytics);
        this.discordBot = discordBot;

        this.allowedRoles = discordBot.settings.plugins.Analytics.pluginSettings.allowedRoles || [];
        this.allowedUsers = discordBot.settings.plugins.Analytics.pluginSettings.allowedUsers || [];
        this.startTrackingAt = discordBot.settings.plugins.Analytics.pluginSettings.startTrackingAt || null;

        console.log('Analytics');

        this.colors = [
            'rgba(75, 192, 192, 1)',
            'rgb(133, 255, 107)',
            'rgb(255, 198, 137)',
            'rgb(255, 153, 153)',
            'rgb(217, 125, 251)',
            'rgb(161, 153, 255)',
            'rgb(81, 5, 108)',
        ];

        this.addCommand({
                data: new SlashCommandBuilder()
                .setName('analytics-retrospective')
                .setDescription('nachträgliches loggen'),
                execute: (discordBot: DiscordBot, interaction: CommandInteraction)=>{
                    this.interactionRetrospectivelyLog(interaction)
                },
        })

        this.addCommand({
                data: new SlashCommandBuilder()
                .setName('analytics-activity')
                .setDescription('gibt die aktivität des Servers zurück')
                .addUserOption(option=>
                    option
                        .setName('user')
                        .setDescription('Von welchem User willst du die Aktivität wissen?')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('days')
                        .setDescription('für die Anzahl der letzten Tage zur Durchschnittsberechnung')
                        .setRequired(false)
                )
                .addChannelOption(option=>
                    option
                        .setName('channel')
                        .setDescription('Aus welchen Channel Willst du die Aktivität wissen?')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('startdate')
                        .setDescription('ab welchem Datum rückwärts gerechnet wird (format: 27.12.1999)')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('weekday')
                        .setDescription('wochentage getrennt mit "," (1 - 7)')
                        .setRequired(false)
                ),
                execute: (discordBot: DiscordBot, interaction: CommandInteraction)=>{
                    this.interactionGetActivityComparison('activity', interaction)
                },
        })

        this.addCommand({
                data: new SlashCommandBuilder()
                .setName('analytics-averagedayactivity')
                .setDescription('Gibt die durchschnittliche tägliche aktivität pro tagesstunde.')
                .addUserOption(option=>
                    option
                        .setName('user')
                        .setDescription('Von welchem User willst du die Aktivität wissen?')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('days')
                        .setDescription('für die Anzahl der letzten Tage zur Durchschnittsberechnung')
                        .setRequired(false)
                )
                .addChannelOption(option=>
                    option
                        .setName('channel')
                        .setDescription('Aus welchen Channel Willst du die Aktivität wissen?')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('startdate')
                        .setDescription('ab welchem Datum rückwärts gerechnet wird (format: 27.12.1999)')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('weekday')
                        .setDescription('wochentage getrennt mit "," (1 - 7)')
                        .setRequired(false)
                ),
                execute: (discordBot: DiscordBot, interaction: CommandInteraction)=>{
                    this.interactionGetActivityComparison('averageDayActivity', interaction)
                },
        })

        this.addCommand({
                data: new SlashCommandBuilder()
                .setName('analytics-c-activity')
                .setDescription('vergleicht aktivitäten des Servers.')
                .addStringOption(option=>
                    option
                        .setName('userids')
                        .setDescription('user Ids getrennt mit "," "alle" statt eine id um die generelle serveraktivität zu nehmen.')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('channelids')
                        .setDescription('channel Ids getrennt mit "," "alle" statt eine id um die generelle serveraktivität zu nehmen.')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('days')
                        .setDescription('für die Anzahl der letzten Tage zur Durchschnittsberechnung')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('startdate')
                        .setDescription('ab welchem Datum rückwärts gerechnet wird (format: 27.12.1999)')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('weekday')
                        .setDescription('wochentage getrennt mit "," (1 - 7)')
                        .setRequired(false)
                ),
                execute: (discordBot: DiscordBot, interaction: CommandInteraction)=>{
                    this.interactionGetActivityComparison('activity', interaction)
                },
        })

        this.addCommand({
                data: new SlashCommandBuilder()
                .setName('analytics-c-averagedayactivity')
                .setDescription('vergleicht durchschnittliche tägliche aktivität pro tagesstunde')
                .addStringOption(option=>
                    option
                        .setName('userids')
                        .setDescription('user Ids getrennt mit "," "alle" statt eine id um die generelle serveraktivität zu nehmen.')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('channelids')
                        .setDescription('channel Ids getrennt mit "," "alle" statt eine id um die generelle serveraktivität zu nehmen.')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('days')
                        .setDescription('für die Anzahl der letzten Tage zur Durchschnittsberechnung')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('startdate')
                        .setDescription('ab welchem Datum rückwärts gerechnet wird (format: 27.12.1999)')
                        .setRequired(false)
                )
                .addStringOption(option=>
                    option
                        .setName('weekday')
                        .setDescription('wochentage getrennt mit "," (1 - 7)')
                        .setRequired(false)
                ),
                execute: (discordBot: DiscordBot, interaction: CommandInteraction)=>{
                    this.interactionGetActivityComparison('averageDayActivity', interaction)
                },
        })
        

        
        this.discordBot.addEventListener('event-messageCreate', async (message: Message)=>{
            if( message.author.bot ) return;
            const sql = `
                INSERT INTO st_um_user_messages (
                    UM_MSG_ID,
                    UM_JS_TIMESTAMP,
                    UM_US_ID,
                    UM_CH_ID
                ) VALUES (
                    ?,
                    ?,
                    ?,
                    ? 
                )
            `;
            await this.discordBot.db.query(sql, [message.id, new Date().getTime(), message.author.id, message.channel.id]);
        })
        

        
        this.discordBot.addEventListener('event-messageDelete', async (message: Message)=>{
            if( message.author?.bot ) return;
            const sql = `
                DELETE FROM st_um_user_messages WHERE UM_MSG_ID = ?
            `;            

            const rtn = await this.discordBot.db.query(sql, [message.id]);
        })
    }

    async allowedToUse(memberid: string){
        if(this.allowedUsers.includes(memberid)) return true;
        for(let i = 0; i < this.allowedRoles.length; i++){
            if(await this.discordBot.botUtils.hasRole(memberid, this.allowedRoles[i])) return true;
        }

        return false;
    }

    sendInvalidDate(interaction: CommandInteraction){
        const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
        embed.setTitle('Invalides Datum!');
        embed.setDescription(`Dieses Datum ist invalide. Bitte gib dein Geburtsdatum im folgendem Format an: dd.mm.yyyy also z.B.: 27.12.1999`);
        interaction.reply({embeds: [embed], ephemeral: true});
    }

    async interactionRetrospectivelyLog(interaction: CommandInteraction){

        if (!(await this.allowedToUse(interaction.user.id))) return;

        if(!interaction.channel) return;

        let messages: Message[] = [];
        let maxMsgs =50000;
        let lastMessageId = undefined;

        while (messages.length < maxMsgs) {
            let limit: any = maxMsgs - messages.length;
            if(limit > 100) limit = 100;
            const fetchMessagesOptions: FetchMessagesOptions = {
                limit: limit,
                before: lastMessageId
            }
            const fetchedMessages = await interaction.channel.messages.fetch(fetchMessagesOptions);
        
            if (fetchedMessages.size === 0) break;
        
            let fetchedMessagesArray =  Array.from(fetchedMessages.values())

            messages = messages.concat(fetchedMessagesArray);
            lastMessageId = fetchedMessages.last()?.id;
        }
        
        messages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        
        for(let i = 0; i < messages.length; i++){
            const message = messages[i];
            
            const sql = `
                INSERT INTO st_um_user_messages (
                    UM_MSG_ID,
                    UM_JS_TIMESTAMP,
                    UM_US_ID,
                    UM_CH_ID
                ) VALUES (
                    ?,
                    ?,
                    ?,
                    ? 
                )
            `;
            await this.discordBot.db.query(sql, [message.id, message.createdTimestamp, message.author.id, message.channel.id]);
        }
    }

    async interactionGetActivityComparison(type: string, interaction: CommandInteraction){
        if (await this.allowedToUse(interaction.user.id)) {
            const interactionOptions = this.discordBot.botUtils.getOptionsObjectFromInteraction(interaction)
            if(isNaN(Number(interactionOptions.days))){
                interactionOptions.days = null;
            }else{
                interactionOptions.days = Number(interactionOptions.days);
            }
            const interactionMsg = await interaction.reply({embeds: [this.discordBot.defaultEmbeds.getWaitEmbed()]})

            const weekdays = (interactionOptions.weekday ? interactionOptions.weekday.split(',') : []).map(Number);

            const userIds = interactionOptions.userids ? interactionOptions.userids.split(',') : (interactionOptions.user ? [interactionOptions.user] : ['alle']);
            const channelIds = interactionOptions.channelids ? interactionOptions.channelids.split(',') : (interactionOptions.channel ? [interactionOptions.channel] : null);
            let iterate = null;
            if(userIds) iterate = userIds
            else iterate = channelIds
            if(userIds && channelIds && userIds.length !== channelIds.length){
                const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
                embed.setTitle('User-Channel Länge');
                embed.setDescription('Wenn du User und Channel angibst musst du genausoviele channel wie user angeben.');
        
                interactionMsg.edit({ embeds: [embed]});
                return;
            }

            let date = new Date();
            if(interactionOptions.startdate){
                const aDate = interactionOptions.startdate.split('.');
                if(aDate.length !== 3){
                    this.sendInvalidDate(interaction);
                    return;
                }
                const day = aDate[0];
                const month = aDate[1];
                const year = aDate[2];
    
                date = new Date(`${year}-${month}-${day}`);
                if(isNaN(date.getTime())){
                    this.sendInvalidDate(interaction);
                    return;
                }
                date = new Date(date.getTime() + (1000 * 60 * 60 * 24))
            }

            const activitys = [];
            const bezs = [];
            for(let i = 0; i < iterate.length; i++){
                activitys.push(await this.getActivity(!userIds || userIds[i] == 'alle' ? null : userIds[i], interactionOptions.days, date ? date.getTime() : new Date().getTime(), !channelIds || channelIds[i] == 'alle' ? null : channelIds[i], weekdays))

                let bezUser = '';
                let bezChannel = '';
                if(!userIds || userIds[i] == 'alle'){
                    bezUser = 'Serveraktivität';
                }else{
                    const member = await this.discordBot.botUtils.fetchMember(userIds[i]);
                    if(!member) {
                        bezUser = 'undefiniert';
                    }else{
                        bezUser = this.discordBot.botUtils.getnick(member);
                    }
                }
                if(!channelIds || channelIds[i] == 'alle'){
                    bezChannel = '';
                }else{
                    const channel = await this.discordBot.guild?.channels.fetch(channelIds[i]);
                    if(!channel) {
                        bezChannel = 'undefiniert';
                    }else{
                        bezChannel = channel.name;
                    }
                }
                bezs.push(`${bezUser}${bezChannel !== '' ? ' - ':''}${bezChannel}`);
            }

            let name;
            if(type == 'averageDayActivity'){
                name = await this.createAverageDayActivityImage(activitys, bezs);
            }else{
                name = await this.createTimeActivityImage(activitys, bezs);
            }
            
            const path = `${homePath}/plugins/Analytics/output/${name}`;
            await interactionMsg.edit({embeds: [], content: this.getTimeActiveDesc(type == 'averageDayActivity' ? 'Durchschnitts Tagesaktivität' : 'Serveraktivität', interactionOptions, interaction), files: [{ attachment: path }]});
            fs.unlinkSync(path);
        } else {
            const embed = this.discordBot.defaultEmbeds.getDefaultEmbed('error');
            embed.setTitle('Keine Berechtigungen');
            embed.setDescription('Du hast keine Rechte....');
    
            interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    getTimeActiveDesc(title: string, interactionOptions: any, interaction: CommandInteraction){
        const desc = [`# ${title}`];

        desc.push(`command: ${this.discordBot.botUtils.regenerateCommand(interaction)}`);

        if(interactionOptions.user) desc.push(`User: <@${interactionOptions.user}>`);
        if(interactionOptions.days) desc.push(`Tage: ${interactionOptions.days}`);
        if(interactionOptions.datum) desc.push(`date: <#${interactionOptions.datum}>`);
        if(interactionOptions.channel) desc.push(`Channel: <#${interactionOptions.channel}>`);
        desc.push(`-# powered by Jishinix`);


        return desc.join('\n');
    }

    async getActivity(userId = null, daysLength = null, startBack = new Date().getTime(), channelId = null, weekdays: number[] = []){
        const sql = `
            SELECT UM_JS_TIMESTAMP as timestamp FROM st_um_user_messages
            WHERE 1 = 1 AND ( 1 = 1
                ${(this.startTrackingAt ? ' AND UM_JS_TIMESTAMP > ?' : '')}
                ${(userId ? ' AND UM_US_ID = ?' : '')}
                ${(daysLength ? ' AND UM_JS_TIMESTAMP > ?' : '')}
                ${(startBack ? ' AND UM_JS_TIMESTAMP < ?' : '')}
                ${(channelId ? ' AND UM_CH_ID = ?' : '')}
            )
            ORDER BY UM_JS_TIMESTAMP
        `;
    

        const values = [];
        if(this.startTrackingAt) values.push(this.startTrackingAt);
        if(userId) values.push(userId);
        if(daysLength) values.push(new Date(startBack).getTime() - (daysLength * 24 * 60 * 60 * 1000));
        if(startBack) values.push(startBack);
        if(channelId) values.push(channelId);
        
        const rtn = (await this.discordBot.db.query(sql, values))[0];

        if(weekdays.length == 0){
            return rtn;
        }
        
        const filterdWeekdays = rtn.filter((msg:any)=>{
            let day = moment(Number(msg.timestamp)).day();
            if(day === 0) day = 7;
            return weekdays.includes(day);
        })

        return filterdWeekdays;
    }

    determineUnit(data: any) {
        const firstMessage = moment(Number(data[0].timestamp));
        const lastMessage = moment(Number(data[data.length - 1].timestamp));
        const duration = moment.duration(lastMessage.diff(firstMessage));
    
        if (duration.asDays() < 30) {
            return 'day';
        } else if (duration.asMonths() < 12) {
            return 'month';
        } else {
            return 'year';
        }
    }
    
    getActivityDataByUnit(data: any) {
        data = Array.isArray(data) ? data : [data];
        const unit = this.determineUnit(data);
        const activity = [];
        const formatMap = {
            day: 'YYYY-MM-DD',
            month: 'YYYY-MM',
            year: 'YYYY'
        };
        
        const firstDate = moment(Number(data[0].timestamp)).startOf(unit);
        const lastDate = moment(Number(data[data.length - 1].timestamp)).startOf(unit);
        
        const messageMap = new Map();
        data.forEach((message: any) => {
            const date = moment(Number(message.timestamp)).format(formatMap[unit]);
            messageMap.set(date, (messageMap.get(date) || 0) + 1);
        });
        
        let currentDate = firstDate.clone();
        while (currentDate.isSameOrBefore(lastDate)) {
            const dateStr = currentDate.format(formatMap[unit]);
            activity.push({
                anzeige: dateStr,
                msgAnzahl: messageMap.get(dateStr) || 0
            });
            currentDate.add(1, unit);
        }
        
        return { unit, activity };
    }
    
    async createAverageDayActivityImage(msgDatas: any, topBezs: any) {
        // AktivitÃÂÃÂ¤t nach Stunde gruppieren

        let labels;
        const datasets = [];
        for(let i = 0; i < msgDatas.length; i++){
            const hourlyActivity = Array(24).fill(0); // 24 Stunden, initial auf 0 gesetzt
            const hourCounts = Array(24).fill(0); // ZÃÂÃÂ¤hlt, wie viele Nachrichten pro Stunde vorhanden sind

            const firstMessage = msgDatas[i][0] ? moment(Number(msgDatas[i][0].timestamp)) : moment();
            const lastMessage = msgDatas[i][msgDatas[i].length - 1] ? moment(Number(msgDatas[i][msgDatas[i].length - 1].timestamp)): moment();
            const duration = moment.duration(lastMessage.diff(firstMessage));
        
            // Nachrichten nach Stunden gruppieren
            msgDatas[i].forEach((message: any) => {
                const messageHour = moment(Number(message.timestamp)).hour();
                hourlyActivity[messageHour] += 1;
                hourCounts[messageHour] += 1;
            });
            let dailyAverageMessages = 0;
            for(let j = 0; j < hourlyActivity.length; j++){
                hourlyActivity[j] = hourlyActivity[j]/Math.ceil(duration.asDays())
                dailyAverageMessages += hourlyActivity[j];
            }

            let name = topBezs[i].match(/[a-zA-Z0-9]+/g).join(' ');
            if(name == ''){
                if(topBezs[i].length > 10){
                    name = `${topBezs[i].slice(0,10)}...`;
                }else{
                    name = topBezs[i];
                }
            }

            labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
            datasets.push({
                label: `${name} (${dailyAverageMessages})`,
                data: hourlyActivity,
                fill: false,
                borderColor: this.colors[i % this.colors.length],
                tension: 0.1
            })
        }
    
        const canvas = createCanvas(1600, 800);
        const ctx: any = canvas.getContext('2d');
        ctx.fillStyle = 'white'; // Oder eine andere Farbe
    
    
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: false,
                scales: {
                    x: {
                        type: 'category', // Skala auf 'category' setzen
                        title: {
                            display: true,
                            text: 'Stunde des Tages'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: ''
                        },
                        beginAtZero: true
                    }
                }
            },
            plugins: [plugin]
        });
    
        // Bild als PNG speichern
        const name = `${short.generate()}.png`
        const out = fs.createWriteStream(`${homePath}/plugins/Analytics/output/${name}`);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        await new Promise((res)=>{
            out.on('finish', () => {
                res(null);
            });
        })

        return name;
    }

    async createTimeActivityImage(msgDatas: any, topBezs: any){
        // Canvas erstellen (GrÃÂÃÂ¶ÃÂÃÂe 800x400)
        const canvas = createCanvas(1600, 800);
        const ctx: any = canvas.getContext('2d');
        ctx.fillStyle = 'white'; // Oder eine andere Farbe
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Daten fÃÂÃÂ¼r das Liniendiagramm vorbereiten
        const datasets = [];
        let labels: string[] = [];
        let units;
        for(let i = 0; i < msgDatas.length; i++){
            const { unit, activity } = this.getActivityDataByUnit(msgDatas[i]);
            units = unit;
            labels = activity.map(entry => entry.anzeige);
            const data = activity.map(entry => entry.msgAnzahl);

            datasets.push(
                {
                    label: topBezs[i],
                    data: data,
                    fill: false,
                    borderColor: this.colors[i % this.colors.length],
                    tension: 0.1
                }
            );
        }

        // Liniendiagramm mit Chart.js erstellen

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets,
            },
            options: {
                responsive: false,
                scales: {
                    x: {
                        type: 'category', // Skala auf 'category' setzen
                        title: {
                            display: true,
                            text: units === 'day' ? 'Datum' : units === 'month' ? 'Monat' : 'Jahr'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Anzahl der Nachrichten'
                        },
                        beginAtZero: true
                    }
                }
            },
            plugins: [plugin]
        });

        // Bild als PNG speichern
        const name = `${short.generate()}.png`
        const out = fs.createWriteStream(`${homePath}/plugins/Analytics/output/${name}`);
        const stream = canvas.createPNGStream();
        stream.pipe(out);
        await new Promise((res)=>{
            out.on('finish', () => {
                res(null);
            });
        })

        return name;
    }
}