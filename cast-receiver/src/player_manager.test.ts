import { Howl } from "howler";
import PlayerManager from "./player_manager";
import { PlayerAction, PlayerStatusEventType } from "./types";

const mockHowl = {
  playing: jest.fn(),
  once: jest.fn(),
  loop: jest.fn(),
  fade: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  volume: jest.fn(),
  unload: jest.fn(),
};

jest.mock("howler", () => {
  return {
    Howl: jest.fn().mockImplementation(() => mockHowl),
  };
});

jest.useFakeTimers();

describe("PlayerManager#handlePlayerEvent", () => {
  const playerStatusCallback = jest.fn();
  let manager: PlayerManager;

  beforeEach(() => {
    manager = new PlayerManager();
    manager.onPlayerStatus(playerStatusCallback);
  });

  function createTestPlayer(): void {
    manager.handlePlayerEvent({
      isLooping: false,
      soundKey: "test",
      volume: 1,
      action: PlayerAction.Create,
    });
  }

  it("should do nothing before Create action", () => {
    manager.handlePlayerEvent({
      isLooping: false,
      soundKey: "test",
      volume: 1,
      action: null,
    });

    expect(Howl).not.toHaveBeenCalled();
  });

  it("should initialize Howl instance on Create action", () => {
    createTestPlayer();
    expect(Howl).toHaveBeenCalled();
    expect(playerStatusCallback).toHaveBeenCalledWith(
      PlayerStatusEventType.Added,
      "test"
    );
  });

  it("should stop idle timer on Create action", () => {
    createTestPlayer();
    expect(window.clearTimeout).toHaveBeenCalled();
  });

  it("should invoke idle timeout callback on timeout", () => {
    expect(window.setTimeout).toHaveBeenCalled();
    const idleTimeoutCallback = jest.fn();
    manager.onIdleTimeout(idleTimeoutCallback);
    jest.runAllTimers();
    expect(idleTimeoutCallback).toHaveBeenCalled();
  });

  describe("Play action", () => {
    beforeEach(createTestPlayer);

    function playTestPlayer(): void {
      manager.handlePlayerEvent({
        isLooping: false,
        soundKey: "test",
        volume: 1,
        action: PlayerAction.Play,
      });
    }

    it("should start playback", () => {
      mockHowl.playing.mockReturnValue(false);
      playTestPlayer();
      expect(mockHowl.play).toHaveBeenCalled();
    });

    it("should invoke player status callback on successful playback", () => {
      mockHowl.playing.mockReturnValue(false);
      playTestPlayer();
      expect(mockHowl.once).toHaveBeenCalledWith("play", expect.anything());
      mockHowl.once.mock.calls[0][1](); // invoke once callback
      expect(playerStatusCallback).toHaveBeenCalledWith(
        PlayerStatusEventType.Started,
        "test"
      );
    });

    it("should not fade-in non-looping sounds", () => {
      mockHowl.playing.mockReturnValue(false);
      mockHowl.loop.mockReturnValue(false);
      playTestPlayer();
      expect(mockHowl.once).toHaveBeenCalledWith("play", expect.anything());
      mockHowl.once.mock.calls[0][1](); // invoke once callback
      expect(mockHowl.fade).not.toHaveBeenCalled();
    });

    it("should fade-in looping sounds", () => {
      mockHowl.playing.mockReturnValue(false);
      mockHowl.loop.mockReturnValue(true);
      mockHowl.volume.mockReturnValue(1);
      playTestPlayer();
      expect(mockHowl.once).toHaveBeenCalledWith("play", expect.anything());
      mockHowl.once.mock.calls[0][1](); // invoke once callback
      expect(mockHowl.fade).toHaveBeenCalledWith(0, 1, expect.anything());
    });

    it("should do noop if playback is already ongoing", () => {
      mockHowl.playing.mockReturnValue(true);
      playTestPlayer();
      expect(mockHowl.play).not.toHaveBeenCalled();
    });
  });

  describe("Pause action", () => {
    beforeEach(createTestPlayer);

    function pauseTestPlayer(): void {
      manager.handlePlayerEvent({
        isLooping: false,
        soundKey: "test",
        volume: 1,
        action: PlayerAction.Pause,
      });
    }

    it("should pause playback", () => {
      pauseTestPlayer();
      expect(mockHowl.pause).toHaveBeenCalledTimes(1);
    });

    it("should invoke the player status callback", () => {
      pauseTestPlayer();
      expect(playerStatusCallback).toHaveBeenCalledWith(
        PlayerStatusEventType.Paused,
        "test"
      );
    });
  });

  describe("Stop action", () => {
    beforeEach(createTestPlayer);

    function stopTestPlayer(): void {
      manager.handlePlayerEvent({
        isLooping: false,
        soundKey: "test",
        volume: 1,
        action: PlayerAction.Stop,
      });
    }

    it("should fade-out if playback is on-going", () => {
      mockHowl.playing.mockReturnValue(true);
      mockHowl.volume.mockReturnValue(1);
      stopTestPlayer();
      expect(mockHowl.fade).toHaveBeenCalledWith(1, 0, expect.anything());
    });

    it("should stop playback on finishing fade-out", () => {
      mockHowl.playing.mockReturnValue(true);
      stopTestPlayer();
      expect(mockHowl.once).toHaveBeenCalledWith("fade", expect.anything());
      mockHowl.once.mock.calls[0][1](); // invoke once callback
      expect(mockHowl.stop).toHaveBeenCalled();
      expect(mockHowl.unload).toHaveBeenCalled();
    });

    it("should just stop playback if playback isn't on-going", () => {
      mockHowl.playing.mockReturnValue(false);
      stopTestPlayer();
      expect(mockHowl.stop).toHaveBeenCalled();
      expect(mockHowl.unload).toHaveBeenCalled();
    });

    it("should invoke the player status callback", () => {
      stopTestPlayer();
      expect(playerStatusCallback).toHaveBeenCalledWith(
        PlayerStatusEventType.Removed,
        "test"
      );
    });

    it("should invoke the idle callback if all players are stopped", () => {
      const idleCallback = jest.fn();
      manager.onIdle(idleCallback);
      stopTestPlayer();
      expect(idleCallback).toHaveBeenCalled();
    });

    it("should start idle timer if all players are stopped", () => {
      stopTestPlayer();
      expect(window.setTimeout).toHaveBeenCalled();
    });
  });

  describe("null action", () => {
    beforeEach(createTestPlayer);

    function updateTestPlayerVolume(): void {
      manager.handlePlayerEvent({
        isLooping: false,
        soundKey: "test",
        volume: 1,
      });
    }

    it("should adjust volume with fade if playback is on-going", () => {
      mockHowl.playing.mockReturnValue(true);
      mockHowl.volume.mockReturnValue(0.5);
      updateTestPlayerVolume();
      expect(mockHowl.fade).toHaveBeenCalledWith(0.5, 1, expect.anything());
    });

    it("should adjust volume without fade if playback is not on-going", () => {
      mockHowl.playing.mockReturnValue(false);
      updateTestPlayerVolume();
      expect(mockHowl.volume).toHaveBeenCalledWith(1);
    });
  });
});
