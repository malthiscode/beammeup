-- CreateTable
CREATE TABLE "mod_map_index" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "modFilename" TEXT NOT NULL,
  "modSize" INTEGER NOT NULL,
  "modMtime" DATETIME NOT NULL,
  "mapPath" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "mod_map_index_modFilename_idx" ON "mod_map_index"("modFilename");

-- CreateIndex
CREATE INDEX "mod_map_index_mapPath_idx" ON "mod_map_index"("mapPath");

-- CreateIndex
CREATE UNIQUE INDEX "mod_map_index_unique" ON "mod_map_index"("modFilename", "modSize", "modMtime", "mapPath");
