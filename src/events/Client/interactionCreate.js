const {
  CommandInteraction,
  InteractionType,
  PermissionFlagsBits,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");
const { SearchResult, Track } = require("erela.js");
const MusicBot = require("../../structures/Client");
const db = require("../../schema/prefix.js");
const db2 = require("../../schema/dj");
const db3 = require("../../schema/setup");

module.exports = {
  name: "interactionCreate",
  /**
   *
   * @param {MusicBot} client
   * @param {CommandInteraction} interaction
   */
  run: async (client, interaction) => {
    let prefix = client.prefix;
    const ress = await db.findOne({ Guild: interaction.guildId });
    if (ress && ress.Prefix) prefix = ress.Prefix;

    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      switch (interaction.commandName) {
        case "play":
          /**
           * @type {import("discord.js").AutocompleteFocusedOption}
           */
          const focused = interaction.options.getFocused(true);

          if (focused.name === "input") {
            if (focused.value === "") return;
            /**
             * @type {SearchResult}
             */
            const result = await client.manager.search(
              focused.value,
              interaction.user
            );

            if (result.loadType === "TRACK_LOADED" || "SEARCH_RESULT") {
              /**
               * @type {Track[]}
               */
              const sliced = result.tracks.slice(0, 5).sort();

              if (
                focused.value.match(
                  /(?:https:\/\/open\.spotify\.com\/|spotify:)(?:.+)?(track|playlist|artist|episode|show|album)[\/:]([A-Za-z0-9]+)/ ||
                    /^(?:https?:\/\/|)?(?:www\.)?deezer\.com\/(?:\w{2}\/)?(track|album|playlist)\/(\d+)/ ||
                    /^((?:https?:)\/\/)?((?:deezer)\.)?((?:page.link))\/([a-zA-Z0-9]+)/ ||
                    /(?:https:\/\/music\.apple\.com\/)(?:\w{2}\/)?(track|album|playlist)/g ||
                    /(http(s|):\/\/music\.apple\.com\/..\/.....\/.*\/([0-9]){1,})\?i=([0-9]){1,}/gim ||
                    /(?:https?:\/\/)?(?:www.|web.|m.)?(facebook|fb).(com|watch)\/(?:video.php\?v=\d+|(\S+)|photo.php\?v=\d+|\?v=\d+)|\S+\/videos\/((\S+)\/(\d+)|(\d+))\/?/g
                )
              ) {
                  await interaction.respond(
                    sliced.map((track) => ({
                      name: track.title,
                      value: focused.value,
                    }))
                  );
                  return;
              } else {
                await interaction.respond(
                  sliced.map((track) => ({
                    name: track.title,
                    value: track.uri,
                  }))
                );
              }
            } else if (result.loadType === "LOAD_FAILED" || "NO_MATCHES")
              return;
          }
          break;
      }
    }

    if (interaction.type === InteractionType.ApplicationCommand) {
      const command = client.slashCommands.get(interaction.commandName);
      if (!command) return;

      const embed = new EmbedBuilder().setColor("Red");

      if (command.botPerms) {
        if (
          !interaction.guild.members.me.permissions.has(
            PermissionsBitField.resolve(command.botPerms || [])
          )
        ) {
          embed.setDescription(
            `I don't have **\`${
              command.botPerms
            }\`** permission in ${interaction.channel.toString()} to execute this **\`${
              command.name
            }\`** command.`
          );
          return interaction.reply({ embeds: [embed] });
        }
      }

      if (command.userPerms) {
        if (
          !interaction.member.permissions.has(
            PermissionsBitField.resolve(command.userPerms || [])
          )
        ) {
          embed.setDescription(
            `You don't have **\`${
              command.userPerms
            }\`** permission in ${interaction.channel.toString()} to execute this **\`${
              command.name
            }\`** command.`
          );
          return interaction.reply({ embeds: [embed] });
        }
      }

      const player = interaction.client.manager.get(interaction.guildId);
      if (command.player && !player) {
        if (interaction.replied) {
          return await interaction
            .editReply({
              content: `There is no player for this guild.`,
              ephemeral: true,
            })
            .catch(() => {});
        } else {
          return await interaction
            .reply({
              content: `There is no player for this guild.`,
              ephemeral: true,
            })
            .catch(() => {});
        }
      }
      if (command.inVoiceChannel && !interaction.member.voice.channel) {
        if (interaction.replied) {
          return await interaction
            .editReply({
              content: `You must be in a voice channel!`,
              ephemeral: true,
            })
            .catch(() => {});
        } else {
          return await interaction
            .reply({
              content: `You must be in a voice channel!`,
              ephemeral: true,
            })
            .catch(() => {});
        }
      }
      if (command.sameVoiceChannel) {
        if (interaction.guild.members.me.voice.channel) {
          if (
            interaction.member.voice.channel !==
            interaction.guild.members.me.voice.channel
          ) {
            return await interaction
              .reply({
                content: `You must be in the same ${interaction.guild.members.me.voice.channel.toString()} to use this command!`,
                ephemeral: true,
              })
              .catch(() => {});
          }
        }
      }
      if (command.dj) {
        let data = await db2.findOne({ Guild: interaction.guildId });
        let perm = PermissionFlagsBits.MuteMembers;
        if (data) {
          if (data.Mode) {
            let pass = false;
            if (data.Roles.length > 0) {
              interaction.member.roles.cache.forEach((x) => {
                let role = data.Roles.find((r) => r === x.id);
                if (role) pass = true;
              });
            }
            if (!pass && !interaction.member.permissions.has(perm))
              return await interaction.reply({
                content: `You don't have permission or dj role to use this command`,
                ephemeral: true,
              });
          }
        }
      }

      try {
        await command.run(client, interaction, prefix);
      } catch (error) {
        if (interaction.replied) {
          await interaction
            .editReply({
              content: `An unexcepted error occured.`,
            })
            .catch(() => {});
        } else {
          await interaction
            .reply({
              ephemeral: true,
              content: `An unexcepted error occured.`,
            })
            .catch(() => {});
        }
        console.error(error);
      }
    }

    if (interaction.isButton()) {
      let data = await db3.findOne({ Guild: interaction.guildId });
      if (
        data &&
        interaction.channelId === data.Channel &&
        interaction.message.id === data.Message
      )
        return client.emit("playerButtons", interaction, data);
    }
  },
};
