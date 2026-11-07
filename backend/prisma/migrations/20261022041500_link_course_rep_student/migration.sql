-- AlterTable
ALTER TABLE "course_reps" ADD COLUMN "student_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "course_reps_student_id_key" ON "course_reps"("student_id");

-- AddForeignKey
ALTER TABLE "course_reps" ADD CONSTRAINT "course_reps_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
