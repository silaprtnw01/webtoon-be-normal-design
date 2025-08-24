-- CreateEnum
CREATE TYPE "public"."PublishStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "public"."Series" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."PublishStatus" NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Chapter" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seriesId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "slug" TEXT,
    "status" "public"."PublishStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Page" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chapterId" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "imageKey" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Series_slug_key" ON "public"."Series"("slug");

-- CreateIndex
CREATE INDEX "Series_status_idx" ON "public"."Series"("status");

-- CreateIndex
CREATE INDEX "Series_deletedAt_idx" ON "public"."Series"("deletedAt");

-- CreateIndex
CREATE INDEX "Chapter_seriesId_idx" ON "public"."Chapter"("seriesId");

-- CreateIndex
CREATE INDEX "Chapter_status_idx" ON "public"."Chapter"("status");

-- CreateIndex
CREATE INDEX "Chapter_deletedAt_idx" ON "public"."Chapter"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_seriesId_number_key" ON "public"."Chapter"("seriesId", "number");

-- CreateIndex
CREATE INDEX "Page_chapterId_idx" ON "public"."Page"("chapterId");

-- CreateIndex
CREATE INDEX "Page_deletedAt_idx" ON "public"."Page"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Page_chapterId_index_key" ON "public"."Page"("chapterId", "index");

-- AddForeignKey
ALTER TABLE "public"."Chapter" ADD CONSTRAINT "Chapter_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "public"."Series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Page" ADD CONSTRAINT "Page_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "public"."Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
