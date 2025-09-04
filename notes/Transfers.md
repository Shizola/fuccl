how the transfers system works.

playfab stores a field called gameWeek in its title data.

playfab also stores a field called currentPlayerTransfersWeek in each users player data. 

when the user loads the transfers page the currentPlayerTransfersWeek is compared to the gameWeek.

for each week currentPlayerTransfersWeek is behind gameWeek, the player data field freeTransfers is increased by one. 

then currentPlayerTransfersWeek set and saved to the value of gameWeek when the user presses the confirm transfers button.
