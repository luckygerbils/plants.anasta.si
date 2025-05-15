#!/usr/bin/env node
import 'source-map-support/register';
import { CodeBuildStep, CodePipeline, CodePipelineSource } from 'aws-cdk-lib/pipelines';
import { App, Stack, Stage } from 'aws-cdk-lib';
import { PrimaryStack } from '../lib/stacks/primary';
import { nonNull } from "../lib/util";
import { ALL_INSTANCES, Beta } from '../lib/instances';
import { DataBucket } from '../lib/s3/buckets';
import { Bucket } from 'aws-cdk-lib/aws-s3';

const env = {
  account: nonNull(process.env.CDK_DEFAULT_ACCOUNT!, "CDK_DEFAULT_ACCOUNT is null"),
  region: "us-west-2",
};

const app = new App();
const pipelineStack = new Stack(app, "Plants-PipelineStack", { env });
const instanceStages = Object.fromEntries(ALL_INSTANCES.map(instance => [instance.name, new Stage(pipelineStack, instance.name, { env })]));
const instanceStacks = Object.fromEntries(ALL_INSTANCES.map(instance => {
  const primary = new PrimaryStack(instanceStages[instance.name], { instance });
  return [instance.name, { primary }];
}));

const synth = new CodeBuildStep("BuildAndSynth", {
  input: CodePipelineSource.gitHub('luckygerbils/plants.anasta.si', 'main'),
  env: {
    DATA_BUCKET: DataBucket.bucketName(Beta),
  },
  commands: [
    'aws s3 cp "s3://$DATA_BUCKET/plants.json" plants.json',
    './run.sh ci',
    './run.sh release',
    './run.sh synth'
  ],
  primaryOutputDirectory: "cdk/cdk.out",
})

const pipeline = new CodePipeline(pipelineStack, 'Pipeline', { pipelineName: 'PlantsPipeline', synth, });
ALL_INSTANCES.forEach(instance => pipeline.addStage(instanceStages[instance.name]));
pipeline.buildPipeline();

Bucket.fromBucketName(pipelineStack, "BetaDataBucket", DataBucket.bucketName(Beta))
  .grantRead(synth.grantPrincipal);

