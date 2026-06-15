import Phaser from "phaser";

/** Loads and unloads per-level background textures on demand. */
export class LevelBackgroundLoader {
  private pending = new Map<string, Promise<void>>();

  isReady(scene: Phaser.Scene, key: string): boolean {
    return scene.textures.exists(key);
  }

  ensureLoaded(scene: Phaser.Scene, key: string, url: string): Promise<void> {
    if (scene.textures.exists(key)) {
      return Promise.resolve();
    }

    const existing = this.pending.get(key);
    if (existing) {
      return existing;
    }

    const promise = new Promise<void>((resolve) => {
      const onComplete = (): void => {
        scene.load.off(`filecomplete-image-${key}`, onComplete);
        scene.load.off("loaderror", onError);
        this.pending.delete(key);
        resolve();
      };

      const onError = (file: Phaser.Loader.File): void => {
        if (file.key !== key) {
          return;
        }
        onComplete();
      };

      scene.load.image(key, url);
      scene.load.once(`filecomplete-image-${key}`, onComplete);
      scene.load.once("loaderror", onError);

      if (!scene.load.isLoading()) {
        scene.load.start();
      }
    });

    this.pending.set(key, promise);
    return promise;
  }

  unload(scene: Phaser.Scene, key: string): void {
    this.pending.delete(key);
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
  }
}
