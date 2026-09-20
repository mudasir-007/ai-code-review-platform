-- AlterTable
ALTER TABLE "Repository" ADD COLUMN     "lastReviewedBranch" TEXT,
ADD COLUMN     "lastReviewedSha" TEXT;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "baseSha" TEXT,
    "headSha" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "changedFiles" TEXT[],
    "prCreated" BOOLEAN NOT NULL DEFAULT false,
    "prUrl" TEXT,
    "prNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
