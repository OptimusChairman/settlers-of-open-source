import { findBestSettlementSpots } from './ai.js';
import { AllBuildCosts, BuildAction, BuildCityAction, BuildActionType, BuildRoadAction, BuildSettlementAction, hydrateBuildAction, BuildActionResponse, actionToString } from './build-actions.js';
import GameMap from './game-map.js';
import GamePlayer from './game-player.js';
import GameTown from './game-town.js';
import { AllResourceTypes, resourceToString, ResourceType, TerrainType } from './terrain-type.js';
import HexCoords, { hydrateHexCoords } from './utils/hex-coords.js';
import VertexCoords, { AllVertexDirections, getHexes } from './utils/vertex-coords.js';

// --- 540-ROLL CASINO SHOE ENGINE ---
let pairPool: [number, number][] = [];

function fisherYatesShuffle(array: [number, number][]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getBalancedPairPool(): [number, number][] {
  if (pairPool.length === 0) {
    const basePairs: [number, number][] = [];
    for (let i = 1; i <= 6; i++) {
      for (let j = 1; j <= 6; j++) {
        basePairs.push([i, j]);
      }
    }
    // 36 pairs x 15 cycles = 540 rolls
    for (let cycle = 0; cycle < 15; cycle++) {
      pairPool.push(...basePairs);
    }
    fisherYatesShuffle(pairPool);
  }
  return pairPool;
}

function getNextDiceRoll(): number {
  const pool = getBalancedPairPool();
  if (pool.length === 0) {
    pairPool = [];
    return getNextDiceRoll();
  }
  const pair = pool.pop() as [number, number];
  return pair[0] + pair[1];
}
// -----------------------------------

// phases requiring input
export enum GamePhase {
  PlaceSettlement1,
  PlaceSettlement2,
  PlaceRobber,
  MainGameplay,
  BuildRoad,
  BuildSettlement,
  BuildCity,
  BuyDevelopmentCard,
  TradeResources,
  GameOver,
}

// roll a 7
// 1. all players discard down to 7 cards
// 2. player choose where to place robber
// 3. player choose which person to rob

export enum RobberPhase {
  ChooseCardsToDiscard,
  PlaceRobber,
  ChooseWhoToRob,
}

type Action = () => void;

export default class Game {
  forceUpdate: Action = () => { };

  // aggregate view of the board
  // Robber
  // longest road, largest army, metropolises
  // deck w/ cards
  // Pieces - roads, settlements etc. Each piece has a ownerIdx pointing to player

  // allPlayerPieces: Map<HexCoords, Piece>

  players: GamePlayer[];

  gamePhase: GamePhase;
  currPlayerIdx: number;
  map: GameMap;
  instructionText: string;
  claimedSettlement: boolean; //only applicable during gamephase.placeSettlement 1&2, if false player is placing settlement, if true they are placing a road.
  robberLocation: HexCoords;
  robberPhase?: RobberPhase;
  robberHexes: HexCoords[];
  turnNumber: number;
  premoveActions: BuildAction[];

  constructor(_options: { debugAutoPickSettlements?: boolean }) {
    this.turnNumber = 0;
    this.claimedSettlement = false;
    this.players = [
      new GamePlayer(0, 'Player 1'),
      new GamePlayer(1, 'Player 2'),
      // new GamePlayer(2, 'Player 3')
    ];

    this.currPlayerIdx = 0;
    this.map = new GameMap();
    this.robberLocation = this.map.robberLocation;
    this.gamePhase = GamePhase.PlaceSettlement1;
    this.instructionText = 'Game Started! Player 1 place first settlement.js';
    this.robberHexes = [];
    this.premoveActions = [];
    // if (options.debugAutoPickSettlements) {
    //   this.autoPickSettlements()
    // }
  }

  setupPhase(): boolean {
    return this.gamePhase == GamePhase.PlaceSettlement1 || this.gamePhase == GamePhase.PlaceSettlement2;
  }

  autoPickSettlements() {
    const pickedSpots = findBestSettlementSpots(this, this.players.length * 2);
    let nextSpotIdx = 0;

    // pick settlement for all players
    for (let i = 0; i < this.players.length; i++) {
      const pickedSpot = pickedSpots[nextSpotIdx++];
      const buildAction = new BuildSettlementAction(i, pickedSpot);
      console.log(`picking settlement
