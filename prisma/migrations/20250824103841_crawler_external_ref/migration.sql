-- CreateTable
CREATE TABLE "public"."ExternalRef" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "seriesId" UUID,
    "chapterId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalRef_seriesId_idx" ON "public"."ExternalRef"("seriesId");

-- CreateIndex
CREATE INDEX "ExternalRef_chapterId_idx" ON "public"."ExternalRef"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRef_source_entity_sourceKey_key" ON "public"."ExternalRef"("source", "entity", "sourceKey");
