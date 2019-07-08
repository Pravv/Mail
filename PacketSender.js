const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = class PacketSender {
    responsePackets = {
        C_CANCEL_CONTRACT: 'S_CANCEL_CONTRACT',
        C_REQUEST_CONTRACT: 'S_REPLY_REQUEST_CONTRACT',
        C_SHOW_PARCEL_MESSAGE: 'S_PARCEL_READ_RECV_STATUS',
        C_RECV_PARCEL: 'S_RECV_PARCEL',
        //C_DELETE_PARCEL: 'S_DELETE_PARCEL',
    };

    constructor(mod) {
        this.mod = mod;
    }

    checkMail(pageIndex = 0) {
        this.mod.send('C_LIST_PARCEL', 2, {
            unk1: 0,
            page: pageIndex,
            filter: 0,
        });
    }

    async deleteParcelMessages(contractId, messages) {
        await this.sendPacket('C_DELETE_PARCEL', 2, {
            id: contractId,
            messages,
        });
        return sleep(100);
    }

    async claimParcelItems({ id }) {
        await this.sendPacket('C_SHOW_PARCEL_MESSAGE', 1, { id });
        await sleep(100);
        return this.sendPacket('C_RECV_PARCEL', 1, { id });
    }

    async cancelContract(contractId) {
        await this.sendPacket('C_CANCEL_CONTRACT', 1, { type: 8, id: contractId });
        return sleep(200);
    }

    async requestContract() {
        return this.sendPacket('C_REQUEST_CONTRACT', 1, { type: 8 });
    }

    async sendPacket(packet, version, payload) {
        this.mod.send(packet, version, payload);

        const responsePacket = this.responsePackets[packet];
        if (!responsePacket) return;

        return this.awaitResult(responsePacket)
          .catch(err => console.error('[mail]', `an error occurred while awaiting for response for ${packet}`, err));
    }

    async awaitResult(packet, timeoutTime = 10 * 1000) {
        const successPromise = new Promise(resolve => this.mod.hookOnce(packet, 'raw', resolve));

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(reject, timeoutTime, new Error(`${packet} timeout`));
        });

        return Promise.race([successPromise, timeoutPromise]);
    }
};
