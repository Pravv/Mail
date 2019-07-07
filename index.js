const PacketSender = require('./PacketSender');

module.exports = function mail(mod) {
    let contractId = -1;
    let parcels = [];
    let deleteAfter = false;
    let gatheringParcels = false;

    const sender = new PacketSender(mod);

    mod.command.add(['mail', 'parcel'], {
        claim: () => {
            gatheringParcels = true;
            sender.checkMail();
        },
        readdel: () => {
            deleteAfter = !deleteAfter;
            mod.command.message(`Deleting parcels after reading them: ${deleteAfter ? 'enabled' : 'disabled'}`);
        },
    });

    const clearState = () => {
        contractId = -1;
        parcels = [];
    };
    mod.hook('S_ACCEPT_CONTRACT', 'raw', clearState);
    mod.hook('S_REJECT_CONTRACT', 'raw', clearState);
    mod.hook('S_CANCEL_CONTRACT', 'raw', clearState);
    mod.hook('S_REQUEST_CONTRACT', 1, event => {
        contractId = event.id;
    });

    mod.hook('S_LIST_PARCEL_EX', 2, async event => {
        if (!gatheringParcels) return;

        for (const message of event.messages) {
            const attached = message.items.map(item => item.id);

            parcels.push({
                id: message.id,
                status: message.status,
                sender: message.sender,
                items: attached,
            });
        }

        if (event.currentPage < event.totalPages - 1) {
            sender.checkMail(event.currentPage + 1);
        } else {
            gatheringParcels = false;
            handleParcels();
        }
    });

    async function handleParcels() {
        if (contractId !== -1) await sender.cancelContract(contractId);

        await sender.requestContract();

        const emptyParcels = [];
        for (const parcel of parcels) {
            if (parcel.status === 2 || (parcel.status === 0 && !parcel.items.length)) {
                emptyParcels.push({id: parcel.id});
            } else if (parcel.items.length) {
                await sender.claimParcelItems(parcel);
                emptyParcels.push({id: parcel.id});
            }
        }

        if (deleteAfter && emptyParcels.length) {
            while (emptyParcels.length) {
                const deletableMessages = getMessagesToDelete(emptyParcels);
                await sender.deleteParcelMessages(contractId, deletableMessages);
            }
        }

        if (contractId !== -1) await sender.cancelContract(contractId);
    }

    function getMessagesToDelete(emptyParcels) {
        if (!emptyParcels.length) return;

        if (emptyParcels.length >= 10) return emptyParcels.splice(0, 10);

        return emptyParcels.splice(0, emptyParcels.length);
    }
};
